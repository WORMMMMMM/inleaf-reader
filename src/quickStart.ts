export type QuickStartAction =
  | 'openPaper'
  | 'chooseLibraryRoot'
  | 'rebuildLibrary'
  | 'setupCodex'
  | 'configureDeepSeek'
  | 'openGuide';

export interface QuickStartOption {
  action: QuickStartAction;
  label: string;
  description: string;
  detail?: string;
}

export function buildQuickStartOptions(input: {
  activePaperName?: string;
  libraryRootCount: number;
  hasDeepSeekKey: boolean;
}): QuickStartOption[] {
  const options: QuickStartOption[] = [
    {
      action: 'openPaper',
      label: '$(book) 打开论文',
      description: input.activePaperName
        ? `在 Inleaf Reader 中打开 ${input.activePaperName}`
        : '选择 PDF 并开始阅读',
      detail: '最快进入标注、翻译和询问 Codex 的入口。'
    },
    {
      action: 'chooseLibraryRoot',
      label: '$(library) 添加论文文库',
      description: input.libraryRootCount
        ? `已配置 ${input.libraryRootCount} 个文库目录`
        : '选择存放论文的文件夹',
      detail: '建立可重建的本地索引，用于论文分类与比较。'
    }
  ];

  if (input.libraryRootCount) {
    options.push({
      action: 'rebuildLibrary',
      label: '$(refresh) 刷新论文文库',
      description: '重新索引 PDF 及其研究档案',
      detail: '添加论文或修改分类后使用此操作。'
    });
  }

  options.push(
    {
      action: 'setupCodex',
      label: '$(terminal) 检查 Codex 集成',
      description: '验证“询问 Codex”，并可选连接只读文库工具',
      detail: '询问 Codex 只需要本地 CLI；MCP 文库访问是可选项，需要单独确认。'
    },
    {
      action: 'configureDeepSeek',
      label: '$(globe) 配置 DeepSeek 翻译',
      description: input.hasDeepSeekKey ? 'API Key 已配置' : '安全保存你的 API Key',
      detail: '密钥只保存在 VS Code SecretStorage 中。'
    },
    {
      action: 'openGuide',
      label: '$(question) 打开入门指南',
      description: '查看最简阅读与研究流程'
    }
  );

  return options;
}
