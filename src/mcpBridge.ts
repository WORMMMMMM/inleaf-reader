import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { INLEAF_IDS } from './identity';
import type { EvidenceLocator } from './researchTypes';

const execFileAsync = promisify(execFile);

export interface McpCurrentSession {
  schemaVersion: 1;
  updatedAt: string;
  pdfPath: string;
  fingerprint: string;
  currentPage: number;
  selection?: EvidenceLocator;
}

export class McpBridge {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async configure(rootPath: string) {
    const root = path.resolve(rootPath);
    const cli = this.cliPath();
    try {
      await execFileAsync(cli, ['mcp', 'get', 'inleaf-reader', '--json'], {
        timeout: 15000,
        maxBuffer: 1024 * 1024
      });
      return { status: 'existing' as const, root };
    } catch (error) {
      const detail = processErrorDetail(error);
      if (!/No MCP server named ['"]?inleaf-reader['"]? found/i.test(detail)) {
        throw new Error(`Could not inspect Codex MCP configuration: ${detail}`);
      }
    }
    const serverPath = path.join(this.extensionUri.fsPath, 'scripts', 'inleaf_mcp_server.mjs');
    const nodePath = await this.nodePath();
    await execFileAsync(cli, [
      'mcp', 'add', 'inleaf-reader', '--', nodePath, serverPath, '--root', root
    ], {
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024
    });
    return { status: 'created' as const, root };
  }

  async remove() {
    try {
      await execFileAsync(this.cliPath(), ['mcp', 'remove', 'inleaf-reader'], {
        timeout: 15000,
        maxBuffer: 1024 * 1024
      });
    } catch (error) {
      throw new Error(`Could not remove the Inleaf MCP entry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async writeCurrentSession(rootPath: string, session: Omit<McpCurrentSession, 'schemaVersion' | 'updatedAt'>) {
    const root = path.resolve(rootPath);
    const pdfPath = path.resolve(session.pdfPath);
    if (!(pdfPath === root || pdfPath.startsWith(`${root}${path.sep}`))) {
      throw new Error('The active PDF is outside the configured library root.');
    }
    const uri = vscode.Uri.file(path.join(root, INLEAF_IDS.sidecarDirectory, 'current-session.json'));
    const temporary = vscode.Uri.file(`${uri.fsPath}.tmp-${randomUUID()}`);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
    try {
      const payload: McpCurrentSession = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        ...session,
        pdfPath
      };
      await vscode.workspace.fs.writeFile(
        temporary,
        Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      );
      await vscode.workspace.fs.rename(temporary, uri, { overwrite: true });
    } catch (error) {
      try { await vscode.workspace.fs.delete(temporary); } catch { /* no temporary file */ }
      throw error;
    }
  }

  private cliPath() {
    return vscode.workspace
      .getConfiguration(INLEAF_IDS.configuration)
      .get<string>('codexCliPath')?.trim() || 'codex';
  }

  private async nodePath() {
    const configured = vscode.workspace
      .getConfiguration(INLEAF_IDS.configuration)
      .get<string>('mcpNodePath')?.trim();
    const candidates = [
      configured,
      'node',
      process.platform === 'darwin' ? '/opt/homebrew/opt/node@22/bin/node' : undefined,
      process.platform === 'darwin' ? '/usr/local/bin/node' : undefined
    ].filter((candidate): candidate is string => !!candidate);
    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ['--version'], { timeout: 5000, maxBuffer: 128 * 1024 });
        return candidate;
      } catch {
        // Try the next explicit executable without changing the user's PATH.
      }
    }
    throw new Error('Node.js is required for the Inleaf MCP server. Set inleafReader.mcpNodePath to a working Node executable.');
  }
}

function processErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') return String(error);
  const processError = error as Error & { stderr?: string; stdout?: string };
  return [processError.message, processError.stderr, processError.stdout]
    .filter(Boolean)
    .join('\n');
}
