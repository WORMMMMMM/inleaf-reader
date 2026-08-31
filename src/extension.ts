import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { INLEAF_IDS } from './identity';
import { LibraryIndexService } from './libraryIndex';
import { McpBridge } from './mcpBridge';
import { PaperReaderPanel } from './paperReaderPanel';
import { isTranslationProvider } from './translationContract';
import { buildQuickStartOptions, type QuickStartAction } from './quickStart';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.window.createOutputChannel('Inleaf Reader');
  const library = new LibraryIndexService(context.globalState);
  const mcp = new McpBridge(context.extensionUri);
  const quickStart = vscode.commands.registerCommand(INLEAF_IDS.commands.quickStart, async (resource?: vscode.Uri) => {
    try {
      const activePaper = isPdfUri(resource) ? resource : activePdfUri();
      const picked = await vscode.window.showQuickPick(
        buildQuickStartOptions({
          activePaperName: activePaper ? path.basename(activePaper.fsPath) : undefined,
          libraryRootCount: library.roots().length,
          hasDeepSeekKey: !!(await context.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey))
        }),
        {
          title: 'Inleaf Reader：快速开始',
          placeHolder: '你想进行什么操作？'
        }
      );
      if (!picked) return;
      await runQuickStartAction(picked.action, context, library, activePaper);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Inleaf 快速开始失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
  const openReader = vscode.commands.registerCommand(INLEAF_IDS.commands.openReader, async (resource?: vscode.Uri) => {
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
          'PDF 文件': ['pdf']
        },
        title: '选择论文 PDF'
      });
      pdfUri = picked?.[0];
    }

    if (!pdfUri) {
      return;
    }

    try {
      PaperReaderPanel.createOrShow(
        context.extensionUri,
        context.secrets,
        context.globalState,
        pdfUri
      );
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    if (!context.globalState.get<boolean>(INLEAF_IDS.globalState.onboardingShown)) {
      await context.globalState.update(INLEAF_IDS.globalState.onboardingShown, true);
      const action = await vscode.window.showInformationMessage(
        'Inleaf Reader 已就绪。选择文本即可使用阅读操作，也可以通过“快速开始”配置可选工具。',
        '快速开始',
        '打开指南'
      );
      if (action === '快速开始') {
        await vscode.commands.executeCommand(INLEAF_IDS.commands.quickStart);
      } else if (action === '打开指南') {
        await vscode.commands.executeCommand(
          'workbench.action.openWalkthrough',
          `${context.extension.id}#${INLEAF_IDS.walkthrough}`,
          false
        );
      }
    }
  });

  const setDeepSeekApiKey = vscode.commands.registerCommand(INLEAF_IDS.commands.setDeepSeekApiKey, async () => {
    const apiKey = await vscode.window.showInputBox({
      title: '设置 DeepSeek API Key',
      prompt: '密钥存储在 VS Code SecretStorage 中。选择 DeepSeek 后，待翻译文本会发送到 DeepSeek API。',
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : '请输入 DeepSeek API Key。'
    });
    if (apiKey === undefined) {
      return;
    }

    await context.secrets.store(INLEAF_IDS.secrets.deepSeekApiKey, apiKey.trim());
    await vscode.workspace
      .getConfiguration(INLEAF_IDS.configuration)
      .update('translationProvider', 'deepseek', vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('DeepSeek API Key 已安全保存，并已设为当前翻译提供商。');
  });

  const clearDeepSeekApiKey = vscode.commands.registerCommand(INLEAF_IDS.commands.clearDeepSeekApiKey, async () => {
    await context.secrets.delete(INLEAF_IDS.secrets.deepSeekApiKey);
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    if (config.get<string>('translationProvider') === 'deepseek') {
      await config.update('translationProvider', 'argos', vscode.ConfigurationTarget.Global);
    }
    vscode.window.showInformationMessage('DeepSeek API Key 已从 VS Code SecretStorage 中移除。');
  });

  const diagnoseTranslation = vscode.commands.registerCommand(INLEAF_IDS.commands.diagnoseTranslation, async () => {
    const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
    const configuredPython = config.get<string>('argosPythonPath')?.trim();
    const pythonPath = configuredPython || path.join(context.extensionUri.fsPath, '.venv-translate', 'bin', 'python');
    const dictionaryPath = path.join(context.extensionUri.fsPath, 'scripts', 'ecdict', 'manifest.json');
    const providerValue = config.get('translationProvider');
    const provider = providerValue === undefined ? 'argos' : providerValue;
    const lines = [
      'Inleaf Reader 翻译诊断',
      `提供商：${isTranslationProvider(provider) ? provider : `无效（${String(provider)}）`}`,
      `离线词典：${fs.existsSync(dictionaryPath) ? '已就绪' : `缺失（${dictionaryPath}）`}`,
      `Argos Python：${fs.existsSync(pythonPath) ? pythonPath : `未找到（${pythonPath}）`}`,
      `LibreTranslate 回退：${config.get<boolean>('translationFallbackToLibreTranslate') ? '已启用' : '已禁用'}`,
      `DeepSeek API Key：${(await context.secrets.get(INLEAF_IDS.secrets.deepSeekApiKey)) ? '已配置' : '未配置'}`
    ];

    if (fs.existsSync(pythonPath)) {
      try {
        const { stdout } = await execFileAsync(pythonPath, [
          '-c',
          'from argostranslate import translate; print(",".join(sorted(lang.code for lang in translate.get_installed_languages())))'
        ], { timeout: 15000 });
        lines.push(`Argos 已安装语言：${stdout.trim() || '无'}`);
      } catch (error) {
        lines.push(`Argos 检查失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    diagnostics.clear();
    diagnostics.appendLine(lines.join('\n'));
    diagnostics.show(true);
    const missingLocal = !fs.existsSync(pythonPath);
    const action = await vscode.window.showInformationMessage(
      missingLocal
        ? '离线词典可用，但仍需配置 Argos 才能翻译句子。'
        : '翻译诊断已完成，请查看 Inleaf Reader 输出。',
      '打开设置'
    );
    if (action === '打开设置') {
      await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${context.extension.id}`);
    }
  });

  const chooseLibraryRoot = vscode.commands.registerCommand(INLEAF_IDS.commands.chooseLibraryRoot, async () => {
    const picked = await vscode.window.showOpenDialog({
      title: '选择 Inleaf 论文文库目录',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    if (!picked?.[0]) return;
    await library.addRoot(picked[0].fsPath);
    const index = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Inleaf Reader：正在索引论文文库',
      cancellable: false
    }, () => library.rebuildRoot(picked[0].fsPath));
    vscode.window.showInformationMessage(
      `Inleaf 文库已索引 ${index.papers.length} 篇论文。`
    );
  });

  const rebuildLibrary = vscode.commands.registerCommand(INLEAF_IDS.commands.rebuildLibrary, async () => {
    const root = await pickLibraryRoot(library.roots());
    if (!root) {
      await vscode.commands.executeCommand(INLEAF_IDS.commands.chooseLibraryRoot);
      return;
    }
    const index = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Inleaf Reader：正在重建论文文库',
      cancellable: false
    }, () => library.rebuildRoot(root));
    vscode.window.showInformationMessage(`Inleaf 文库已重建，共 ${index.papers.length} 篇论文。`);
  });

  const configureCodexMcp = vscode.commands.registerCommand(INLEAF_IDS.commands.configureCodexMcp, async () => {
    const root = await pickLibraryRoot(library.roots());
    if (!root) {
      vscode.window.showErrorMessage('配置 MCP 前，请先选择并索引一个 Inleaf 论文文库目录。');
      return;
    }
    const result = await mcp.configure(root);
    vscode.window.showInformationMessage(result.status === 'created'
      ? `已为 ${root} 配置只读 Inleaf MCP 服务。请重启 Codex 会话以载入该配置。`
      : '只读 Inleaf MCP 服务已配置，现有配置保持不变。');
  });

  const removeCodexMcp = vscode.commands.registerCommand(INLEAF_IDS.commands.removeCodexMcp, async () => {
    await mcp.remove();
    vscode.window.showInformationMessage('已从 Codex 配置中移除 Inleaf MCP 条目。');
  });

  context.subscriptions.push(
    quickStart,
    openReader,
    setDeepSeekApiKey,
    clearDeepSeekApiKey,
    diagnoseTranslation,
    chooseLibraryRoot,
    rebuildLibrary,
    configureCodexMcp,
    removeCodexMcp,
    diagnostics
  );
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

async function pickLibraryRoot(roots: string[]) {
  if (roots.length === 1) return roots[0];
  if (!roots.length) return undefined;
  const picked = await vscode.window.showQuickPick(
    roots.map(root => ({ label: path.basename(root), description: root, root })),
    { title: '选择 Inleaf 论文文库目录' }
  );
  return picked?.root;
}

async function runQuickStartAction(
  action: QuickStartAction,
  context: vscode.ExtensionContext,
  library: LibraryIndexService,
  activePaper?: vscode.Uri
) {
  switch (action) {
    case 'openPaper':
      await vscode.commands.executeCommand(INLEAF_IDS.commands.openReader, activePaper);
      return;
    case 'chooseLibraryRoot':
      await vscode.commands.executeCommand(INLEAF_IDS.commands.chooseLibraryRoot);
      return;
    case 'rebuildLibrary':
      await vscode.commands.executeCommand(INLEAF_IDS.commands.rebuildLibrary);
      return;
    case 'setupCodex':
      await setupCodexIntegration(context, library);
      return;
    case 'configureDeepSeek':
      await vscode.commands.executeCommand(INLEAF_IDS.commands.setDeepSeekApiKey);
      return;
    case 'openGuide':
      await vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        `${context.extension.id}#${INLEAF_IDS.walkthrough}`,
        false
      );
  }
}

async function setupCodexIntegration(
  context: vscode.ExtensionContext,
  library: LibraryIndexService
) {
  const config = vscode.workspace.getConfiguration(INLEAF_IDS.configuration);
  const cliPath = config.get<string>('codexCliPath')?.trim() || 'codex';
  let version: string;
  try {
    const result = await execFileAsync(cliPath, ['--version'], {
      timeout: 8000,
      maxBuffer: 1024 * 1024
    });
    version = (result.stdout || result.stderr).trim() || 'Codex CLI';
  } catch (error) {
    const action = await vscode.window.showErrorMessage(
      `未找到 Codex CLI：${error instanceof Error ? error.message : String(error)}`,
      '打开 Inleaf 设置'
    );
    if (action === '打开 Inleaf 设置') {
      await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${context.extension.id}`);
    }
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `${version} 已就绪，现在可以询问 Codex。通过 MCP 访问只读文库是可选项。`,
    '配置文库访问',
    '完成'
  );
  if (action !== '配置文库访问') return;
  if (!library.roots().length) {
    await vscode.commands.executeCommand(INLEAF_IDS.commands.chooseLibraryRoot);
  }
  if (!library.roots().length) return;
  await vscode.commands.executeCommand(INLEAF_IDS.commands.configureCodexMcp);
}
