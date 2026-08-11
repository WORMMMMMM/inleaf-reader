import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PaperReaderPanel } from './paperReaderPanel';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.window.createOutputChannel('Inleaf Reader');
  const openReader = vscode.commands.registerCommand('readingExtension.openReader', async (resource?: vscode.Uri) => {
    const activeUri = resource || activePdfUri();
    let pdfUri: vscode.Uri | undefined = isPdfUri(activeUri) ? activeUri : undefined;

    if (activeUri?.fsPath.toLowerCase().endsWith('.pdf')) {
      pdfUri = activeUri;
    } else {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'PDF files': ['pdf']
        },
        title: 'Choose a paper PDF'
      });
      pdfUri = picked?.[0];
    }

    if (!pdfUri) {
      return;
    }

    PaperReaderPanel.createOrShow(
      context.extensionUri,
      context.secrets,
      context.globalState,
      pdfUri
    );
    if (!context.globalState.get<boolean>('readingExtension.onboardingShown')) {
      await context.globalState.update('readingExtension.onboardingShown', true);
      const action = await vscode.window.showInformationMessage(
        'Inleaf Reader is ready. Single-word lookup works offline; sentence translation can be configured separately.',
        'Getting Started',
        'Diagnose Translation'
      );
      if (action === 'Getting Started') {
        await vscode.commands.executeCommand(
          'workbench.action.openWalkthrough',
          `${context.extension.id}#readingExtension.gettingStarted`,
          false
        );
      } else if (action === 'Diagnose Translation') {
        await vscode.commands.executeCommand('readingExtension.diagnoseTranslation');
      }
    }
  });

  const setDeepSeekApiKey = vscode.commands.registerCommand('readingExtension.setDeepSeekApiKey', async () => {
    const apiKey = await vscode.window.showInputBox({
      title: 'Set DeepSeek API Key',
      prompt: 'Stored in VS Code SecretStorage. When DeepSeek is selected, translated text is sent to the DeepSeek API.',
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : 'Enter a DeepSeek API key.'
    });
    if (apiKey === undefined) {
      return;
    }

    await context.secrets.store(PaperReaderPanel.deepSeekApiKeySecret, apiKey.trim());
    await vscode.workspace
      .getConfiguration('readingExtension')
      .update('translationProvider', 'deepseek', vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('DeepSeek API key stored securely. DeepSeek is now the translation provider.');
  });

  const clearDeepSeekApiKey = vscode.commands.registerCommand('readingExtension.clearDeepSeekApiKey', async () => {
    await context.secrets.delete(PaperReaderPanel.deepSeekApiKeySecret);
    const config = vscode.workspace.getConfiguration('readingExtension');
    if (config.get<string>('translationProvider') === 'deepseek') {
      await config.update('translationProvider', 'argos', vscode.ConfigurationTarget.Global);
    }
    vscode.window.showInformationMessage('DeepSeek API key removed from VS Code SecretStorage.');
  });

  const diagnoseTranslation = vscode.commands.registerCommand('readingExtension.diagnoseTranslation', async () => {
    const config = vscode.workspace.getConfiguration('readingExtension');
    const configuredPython = config.get<string>('argosPythonPath')?.trim();
    const pythonPath = configuredPython || path.join(context.extensionUri.fsPath, '.venv-translate', 'bin', 'python');
    const dictionaryPath = path.join(context.extensionUri.fsPath, 'scripts', 'ecdict_compact.json.gz');
    const lines = [
      'Inleaf Reader translation diagnostics',
      `Provider: ${config.get<string>('translationProvider') || 'argos'}`,
      `Offline dictionary: ${fs.existsSync(dictionaryPath) ? 'ready' : `missing (${dictionaryPath})`}`,
      `Argos Python: ${fs.existsSync(pythonPath) ? pythonPath : `not found (${pythonPath})`}`,
      `LibreTranslate fallback: ${config.get<boolean>('translationFallbackToLibreTranslate') ? 'enabled' : 'disabled'}`,
      `DeepSeek API key: ${(await context.secrets.get(PaperReaderPanel.deepSeekApiKeySecret)) ? 'configured' : 'not configured'}`
    ];

    if (fs.existsSync(pythonPath)) {
      try {
        const { stdout } = await execFileAsync(pythonPath, [
          '-c',
          'from argostranslate import translate; print(",".join(sorted(lang.code for lang in translate.get_installed_languages())))'
        ], { timeout: 15000 });
        lines.push(`Argos installed languages: ${stdout.trim() || 'none'}`);
      } catch (error) {
        lines.push(`Argos check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    diagnostics.clear();
    diagnostics.appendLine(lines.join('\n'));
    diagnostics.show(true);
    const missingLocal = !fs.existsSync(pythonPath);
    const action = await vscode.window.showInformationMessage(
      missingLocal
        ? 'Offline dictionary is available. Argos sentence translation still needs setup.'
        : 'Translation diagnostics completed. See the Inleaf Reader output.',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ziming.reading-extension');
    }
  });

  context.subscriptions.push(openReader, setDeepSeekApiKey, clearDeepSeekApiKey, diagnoseTranslation, diagnostics);
}

export function deactivate() {
  // Webview-owned workers and processes are disposed with their panel.
}

function activePdfUri() {
  const editorUri = vscode.window.activeTextEditor?.document.uri;
  if (isPdfUri(editorUri)) {
    return editorUri;
  }
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) {
    return input.uri;
  }
  return undefined;
}

function isPdfUri(uri?: vscode.Uri): uri is vscode.Uri {
  return !!uri && uri.fsPath.toLowerCase().endsWith('.pdf');
}
