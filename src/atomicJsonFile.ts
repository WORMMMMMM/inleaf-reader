import { randomUUID } from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';

export class AtomicJsonFile<T> {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    readonly uri: vscode.Uri,
    private readonly fallback: () => T,
    private readonly normalize: (value: unknown, fallback: T) => T = value => value as T
  ) {}

  async read(): Promise<T> {
    await this.mutationQueue;
    return this.readNow();
  }

  mutate(operation: (current: T) => T | Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(async () => {
      const current = await this.readNow();
      const updated = await operation(current);
      await this.writeNow(updated);
      return updated;
    }, async () => {
      const current = await this.readNow();
      const updated = await operation(current);
      await this.writeNow(updated);
      return updated;
    });
    this.mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  write(value: T): Promise<T> {
    const next = this.mutationQueue.then(async () => {
      await this.writeNow(value);
      return value;
    }, async () => {
      await this.writeNow(value);
      return value;
    });
    this.mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async readNow(): Promise<T> {
    const fallback = this.fallback();
    try {
      const bytes = await vscode.workspace.fs.readFile(this.uri);
      return this.normalize(JSON.parse(Buffer.from(bytes).toString('utf8')), fallback);
    } catch (error) {
      if (isFileNotFound(error)) {
        return fallback;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not read Inleaf data at ${this.uri.fsPath}: ${detail}. ` +
        `The previous valid version may be available at ${this.uri.fsPath}.bak.`
      );
    }
  }

  private async writeNow(value: T) {
    const directory = vscode.Uri.file(path.dirname(this.uri.fsPath));
    await vscode.workspace.fs.createDirectory(directory);
    const temporaryUri = vscode.Uri.file(`${this.uri.fsPath}.tmp-${randomUUID()}`);
    try {
      await vscode.workspace.fs.writeFile(
        temporaryUri,
        Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
      );
      if (await uriExists(this.uri)) {
        await vscode.workspace.fs.copy(
          this.uri,
          vscode.Uri.file(`${this.uri.fsPath}.bak`),
          { overwrite: true }
        );
      }
      await vscode.workspace.fs.rename(temporaryUri, this.uri, { overwrite: true });
    } catch (error) {
      try {
        await vscode.workspace.fs.delete(temporaryUri);
      } catch {
        // The temporary file may not have been created.
      }
      throw error;
    }
  }
}

async function uriExists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function isFileNotFound(error: unknown) {
  return error instanceof vscode.FileSystemError && error.code === 'FileNotFound';
}
