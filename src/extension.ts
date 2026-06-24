import * as vscode from 'vscode';
import { PaperReaderPanel } from './paperReaderPanel';

export function activate(context: vscode.ExtensionContext) {
  const openReader = vscode.commands.registerCommand('readingExtension.openReader', async () => {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    let pdfUri: vscode.Uri | undefined;

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

  context.subscriptions.push(openReader, setDeepSeekApiKey, clearDeepSeekApiKey);
}

export function deactivate() {
  // No long-lived resources.
}
