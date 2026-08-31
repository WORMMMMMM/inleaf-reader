import * as path from 'path';
import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import type { WordDetails } from './translationTypes';

export class EcdictClient implements vscode.Disposable {
  private worker?: Worker;
  private requestId = 0;
  private pending = new Map<number, {
    resolve(value: WordDetails | undefined): void;
    reject(error: Error): void;
  }>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  lookup(word: string) {
    this.ensureWorker();
    const id = ++this.requestId;
    return new Promise<WordDetails | undefined>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Offline dictionary lookup timed out.'));
      }, 15000);
      this.pending.set(id, {
        resolve: value => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      this.worker?.postMessage({
        id,
        word,
        dictionaryPath: path.join(this.extensionUri.fsPath, 'scripts', 'ecdict')
      });
    });
  }

  dispose() {
    void this.worker?.terminate();
    this.worker = undefined;
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Offline dictionary worker stopped.'));
    }
    this.pending.clear();
  }

  private ensureWorker() {
    if (this.worker) {
      return;
    }
    const workerPath = path.join(this.extensionUri.fsPath, 'out', 'ecdictWorker.js');
    this.worker = new Worker(workerPath);
    this.worker.on('message', (message: { id: number; result?: WordDetails; error?: string }) => {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.result);
      }
    });
    this.worker.on('error', error => this.failWorker(error));
    this.worker.on('exit', code => {
      if (code !== 0) {
        this.failWorker(new Error(`Offline dictionary worker exited with code ${code}.`));
      }
      this.worker = undefined;
    });
  }

  private failWorker(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
