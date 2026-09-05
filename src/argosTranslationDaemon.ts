import * as cp from 'child_process';
import * as fs from 'fs';

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

/** A typed JSON-lines client for the long-lived Argos Python process. */
export class ArgosTranslationDaemon {
  private process?: cp.ChildProcess;
  private startup?: Promise<void>;
  private ready = false;
  private pending = new Map<number, PendingRequest>();
  private requestId = 0;
  private stdoutBuffer = '';
  private requests: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly pythonPath: () => string,
    private readonly daemonPath: string
  ) {}

  request<Result>(payload: object, signal?: AbortSignal): Promise<Result> {
    const result = this.requests.then(() => this.performRequest<Result>(payload, signal));
    this.requests = result.catch(() => undefined);
    return result;
  }

  private async performRequest<Result>(payload: object, signal?: AbortSignal): Promise<Result> {
    signal?.throwIfAborted();
    await this.ensureReady();
    signal?.throwIfAborted();
    return new Promise<Result>((resolve, reject) => {
      const requestId = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        this.stop();
        reject(new Error('Translation daemon request timed out.'));
      }, 30000);
      this.pending.set(requestId, {
        resolve: value => {
          clearTimeout(timeout);
          resolve(value as Result);
        },
        reject: error => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      this.process?.stdin?.write(`${JSON.stringify({ ...payload, requestId })}\n`);
    });
  }

  dispose() {
    this.stop();
  }

  private ensureReady() {
    if (this.process && this.ready) return Promise.resolve();
    this.startup ??= this.start().finally(() => {
      this.startup = undefined;
    });
    return this.startup;
  }

  private async start() {
    if (this.process && this.ready) return;
    if (this.process) this.stop();
    const pythonPath = this.pythonPath();
    if (!fs.existsSync(pythonPath)) {
      throw new Error(`Argos Python not found at ${pythonPath}.`);
    }
    if (!fs.existsSync(this.daemonPath)) {
      throw new Error(`Daemon script not found at ${this.daemonPath}.`);
    }

    const daemon = cp.spawn(pythonPath, [this.daemonPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.process = daemon;
    let stderr = '';
    daemon.stderr?.on('data', chunk => {
      stderr = `${stderr}${chunk.toString()}`.slice(-16000);
    });
    daemon.on('error', () => {
      this.ready = false;
    });
    daemon.on('close', () => {
      this.ready = false;
      this.rejectPending(new Error('Translation daemon exited unexpectedly.'));
    });
    this.listenForResponses(daemon);
    await this.waitUntilReady(daemon, () => stderr);
  }

  private listenForResponses(daemon: cp.ChildProcess) {
    this.stdoutBuffer = '';
    daemon.stdout?.on('data', chunk => {
      this.stdoutBuffer += chunk.toString();
      const lines = this.stdoutBuffer.split('\n');
      this.stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line.trim()) as { ready?: boolean; requestId?: number };
          if (response.ready) {
            this.ready = true;
            continue;
          }
          const requestId = Number(response.requestId);
          const pending = this.pending.get(requestId);
          if (pending) {
            this.pending.delete(requestId);
            pending.resolve(response);
          }
        } catch {
          // Ignore diagnostic output outside the JSON-lines protocol.
        }
      }
    });
  }

  private waitUntilReady(daemon: cp.ChildProcess, stderr: () => string) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(poll);
        daemon.off('close', handleEarlyClose);
        daemon.off('error', handleEarlyError);
        error ? reject(error) : resolve();
      };
      const handleEarlyClose = () => finish(new Error(
        `Translation daemon exited before it became ready.${stderr().trim() ? ` ${stderr().trim()}` : ''}`
      ));
      const handleEarlyError = (error: Error) => finish(error);
      const timeout = setTimeout(() => {
        this.stop();
        finish(new Error('Translation daemon failed to start within 60 seconds.'));
      }, 60000);
      const poll = setInterval(() => {
        if (this.ready) finish();
      }, 100);
      daemon.once('close', handleEarlyClose);
      daemon.once('error', handleEarlyError);
    });
  }

  private stop() {
    this.process?.kill();
    this.process = undefined;
    this.ready = false;
    this.stdoutBuffer = '';
    this.rejectPending(new Error('Translation daemon was killed.'));
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
