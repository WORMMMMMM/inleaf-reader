# Inleaf Reader Research Workspace：Design and Plan

> 文档状态：Phases 1–5 implemented; real-provider and interactive VS Code manual QA pending
> 更新日期：2026-08-30
> 范围：可组合阅读动作、Codex 论文对话、稳定证据定位、论文分类与跨论文比较、机器人论文的 GitHub 仓库关联、DeepSeek 翻译

本文档描述 Inleaf Reader 从单篇 PDF 阅读器扩展为研究工作台的产品设计与实施计划。产品原则、身份约束、依赖方向和通用验证要求仍以 [AGENTS.md](AGENTS.md) 为准；现有文件职责仍以 [project_map.md](project_map.md) 为准。本文只覆盖本次新增能力，不取代这两份文档。

## 1. 结论与范围

本项目将新增一个以论文为中心的 Research Workspace，并保持以下职责分离：

- Inleaf Reader 负责阅读、选区、标注、论文元数据、分类、证据、仓库关系和可移植侧车文件。
- Codex 负责用户主动发起的论文问答、跨论文推理和本地代码仓库分析。
- DeepSeek 作为可选远程翻译提供商，只在用户主动点击翻译时接收选中的文本。
- 用户继续使用自己已经信任的 Codex、DeepSeek 或其他工具；Inleaf Reader 不要求使用捆绑付费 AI。

### 1.1 当前状态边界

| 能力 | 当前状态 | 本计划中的工作 |
| --- | --- | --- |
| PDF 阅读、缩放、进度恢复 | 已实现 | 保持行为与性能 |
| 高亮、下划线、笔记、标签、撤销 | 已实现 | 为研究上下文复用这些数据 |
| ECDICT 单词查询 | 已实现 | 保持单词优先的离线行为 |
| Argos、LibreTranslate、DeepSeek 翻译路由 | 已实现；自动失败矩阵已验证 | 仍需用户在 VS Code SecretStorage 中输入真实 Key，完成 Flash/Pro 人工成功路径 |
| DeepSeek API Key 的 SecretStorage 保存 | 已实现 | 不改变安全边界 |
| 从 PDF 选区发起 Codex 对话 | 已实现并通过上下文/shell 边界测试 | 仍需真实 VS Code Terminal 点击式 QA |
| 论文元数据与机器人领域分类 | 已实现 | `research.json`、确认状态、关系和 source-missing 已进入 Webview |
| 多论文筛选与比较 | 已实现 | 多根 Library、证据矩阵、JSON/Markdown 导出和 Codex 分析入口已完成 |
| GitHub 仓库关联与分析 | 已实现 | URL 净化、显式 clone、commit/branch/dirty/license 快照，以及基于最新快照的只读 Codex 分析入口已完成 |
| 可组合阅读动作 | 已实现 | 轻量 Action Registry、禁用原因和窄宽度 More 已完成 |
| 标注深链接与稳定证据定位 | 已实现 | annotation → geometry → quote 退化与错误指纹拒绝已测试 |
| 启动与使用引导 | 已实现 | `./dev` 一键开发启动、`./install` 安装到普通 VS Code、Quick Start、阅读器 Setup 入口和 walkthrough 已完成 |
| Workbench 信息架构与视觉层级 | 已实现；实机目视待验收 | 左侧功能轨、分层论文工具栏、本地数据状态栏、按需 Inspector、Library 指标卡和比较证据摘要已完成 |

“已实现”只表示源代码中存在相应路径，不等于已经完成当前机器上的真实 API、VSIX 或人工阅读验证。

### 1.2 实施验证快照（2026-08-30）

- `npm test` 已通过：构建 Webview/Extension、全部回归、两个 TypeScript 项目和生成 JavaScript 语法检查均成功。
- 参考语料测试读取 `references/` 顶层 37 篇 PDF，通过临时目录中的硬链接或副本建立 Library；37/37 通过 `pdfinfo`，37/37 的前两页存在可提取文本；原目录未生成 `.inleaf-reader/`。
- DeepSeek 使用虚构凭证和模拟 HTTP 响应覆盖成功、401、429、5xx、断网、取消与超时；真实 Key 未进入命令行、源码、日志、测试、侧车或 VSIX。
- VSIX 已构建并通过压缩包完整性检查；包含 206 个条目和唯一一个公开 README，未包含 PDF、`.inleaf-reader/`、设计文档、API Key 或嵌套 VSIX。
- 本机的应用控制原生管道不可用，因此 PDF 非空白、选区工具条视觉布局、连续滚动和真实 Terminal 交互仍属于明确的人工 QA 待办，不能由上述自动测试替代。

### 1.3 参考实现吸收原则

本计划参考 Nexus 的当前实现，但只吸收与 Inleaf 产品合同一致的模式：

| Nexus 中值得吸收的模式 | Inleaf 中的落地方式 | 明确不照搬的部分 |
| --- | --- | --- |
| 命令注册表与 schema 驱动的工具栏、菜单 | 实现最小 `ReaderActionRegistry`，统一选区动作、可用性和排序；UI 仍保持简洁 | 不复制密集的完整 PDF 编辑工具栏，不默认打开侧栏 |
| PDF viewer、anchor adapter、事件 bridge 分层 | 保持 `PdfDocumentView`、纯 annotation model 与宿主工作流分离，新增稳定 Locator 转换边界 | 不因参考实现而迁移 PDFium；除非现有库出现经过复现的能力瓶颈 |
| 标注与笔记的显式关系、按 annotation ID 深链接 | 用关系记录和 Locator 引用已有标注，不复制标注正文作为新的事实来源 | 不引入服务端关系数据库；正式来源仍是普通侧车文件 |
| 多学术来源并行查询、字段优先级、`ok / empty / error` 状态 | 未来若加入元数据发现，必须记录字段 provenance 和逐来源结果状态 | 不在本计划前四阶段扩展成完整文献发现平台 |
| 独立 PDF reader package 和宿主回调 | 先形成稳定接口和独立测试，再决定是否需要物理拆包 | 不为追求目录对称而提前拆成大量小包 |

参考仓库仍处于快速演化阶段，设计文档与当前代码在 anchor 单位、annotation `autoCommit` 等细节上存在漂移。因此本文以模式为参考，以 Inleaf 源码、测试、`AGENTS.md` 和本文件明确写下的合同为实施依据，不把 Nexus 文档当作 Inleaf 的规范。

## 2. 产品目标与非目标

### 2.1 产品目标

1. 用户在阅读位置即可把当前疑问连同可靠上下文交给 Codex，不需要手动寻找页码、复制标注或切换工作目录。
2. 每篇论文形成一份结构化、可编辑、可追溯的研究档案。
3. 用户可以按机器人研究维度筛选论文，并对 2 至 N 篇论文进行证据化比较。
4. 论文与官方代码仓库、数据集、模型权重和项目主页建立明确关系。
5. 所有研究数据继续使用 PDF 附近的普通文件保存，便于 Git、同步工具和外部 AI 读取。
6. DeepSeek 翻译保持显式、可控、安全，不与 Codex 对话或论文分类隐式混用。

### 2.2 非目标

- 第一阶段不在 Inleaf Reader 内重建完整的 Codex 聊天客户端。
- 第一阶段不建立云端论文账户、专有云数据库或不可导出的向量库。
- 不在用户打开论文时自动克隆 GitHub 仓库、调用远程模型或上传全文。
- 不把 AI 自动提取的分类、论文结论或仓库能力直接标记为已验证事实。
- 不支持无文本层扫描 PDF；OCR 必须作为未来独立能力设计。
- 不把论文分类、对话记录、仓库分析结果写入 VS Code GlobalState。
- 不在本计划内用 PDFium、服务端 PDF reader 或另一套渲染层替换 `react-pdf-highlighter-plus`；引擎迁移必须由可复现的现有限制、性能数据和迁移 QA 单独立项。
- 不引入 PostgreSQL、Redis、对象存储或常驻云服务作为阅读、标注、分类或比较的必要条件。
- 不把工具栏 schema 化理解为“显示更多按钮”；默认界面仍优先最少动作和不中断阅读。

## 3. 关键用户流程

### 3.1 从选区询问 Codex

1. 用户在 PDF 中选中一段文本。
2. `ReaderActionRegistry` 根据当前选区、提供商就绪状态和文档会话生成可用动作；选区工具条显示 `Ask Codex`，并提供快捷意图：
   - Explain
   - Critique
   - Relate to my work
   - Ask custom question
3. 用户输入问题或选择快捷意图。
4. Webview 将问题、选区位置和当前 `documentId` 发给 Extension Host。
5. Extension Host 生成当前论文上下文文件，并打开或复用 `Inleaf Codex` Terminal。
6. Codex 在 PDF 所在目录启动，首先读取上下文文件，然后进入可持续追问的交互会话。
7. 用户回到 PDF 后可继续选择其他段落，并将新的上下文追加到同一论文会话。

选区动作不得自动打开 Inleaf 右侧面板。启动 Terminal 是用户点击 `Ask Codex` 后的显式结果。

### 3.2 论文分类

1. 用户打开 `Research` 面板或运行 `Classify Paper`。
2. Inleaf 展示现有元数据和可选的自动提取建议。
3. 用户确认、修改或删除分类字段。
4. 只有确认后的字段进入常规筛选；未确认字段显示来源与置信状态。
5. 数据保存到当前 PDF 的研究侧车文件。

### 3.3 跨论文比较

1. 用户打开 Library，筛选或选择 2 至 N 篇论文。
2. 用户选择比较模板或自定义维度。
3. 系统从已确认研究档案、标注和仓库快照中构建比较输入。
4. 缺少证据的单元格显示 `unknown`，而不是由模型补全成事实。
5. 用户可选择让 Codex 分析差异，但结果必须保留来源论文、页码或仓库 commit。
6. 比较结果可导出为 Markdown 和 JSON。

### 3.4 关联和分析 GitHub 仓库

1. 用户手动粘贴仓库 URL，或确认从论文中识别出的候选链接。
2. Inleaf 记录链接关系，例如 `official implementation`、`dataset` 或 `community reproduction`。
3. `Clone Repository...` 必须显示目标目录并获得用户确认。
4. 仓库分析记录 URL、默认分支、commit SHA、许可证、关键入口和提取时间。
5. `Analyze with Codex` 以只读权限启动，输入同时包含论文研究档案与仓库快照。
6. 论文声明、仓库 README 声明和实际代码证据分别记录。

### 3.5 使用 DeepSeek 翻译

1. 用户运行 `Inleaf Reader: Set DeepSeek API Key`，或在 Translation 面板选择 DeepSeek 后进入密钥配置。
2. 密钥通过密码输入框写入 VS Code SecretStorage。
3. 用户选择 `deepseek-v4-flash` 或 `deepseek-v4-pro`，并设置目标语言。
4. 用户选中文本并点击 `Translate`。
5. 单个英文单词默认优先走 ECDICT；句子和段落走 DeepSeek。
6. Webview 只接收翻译结果和提供商状态，永远不接收 API Key。

未来可增加 `inleafReader.singleWordTranslationProvider`，让用户选择单词继续优先 ECDICT，或强制使用当前远程翻译提供商。

### 3.6 从研究结果返回原文

1. 标注、研究事实、比较单元格和 Codex 上下文引用统一保存 `EvidenceLocator`。
2. 用户在 Research、Comparison、Markdown 导出或 Codex 结果中触发定位。
3. Extension Host 先用文档指纹解析当前 PDF，再向对应 Webview 发送 `focusEvidence`。
4. Webview 优先按 `annotationId` 定位；标注不存在时，退化到页码与几何位置；几何位置失效时，再以原文和邻近上下文提示用户确认。
5. 定位失败必须显示失败原因，不得静默跳到相似但未经确认的文本。

Locator 只描述“如何重新找到证据”，不复制或升级证据状态。删除标注后，引用该标注的研究事实可以保留原文快照，但必须显示 `sourceMissing`，不能继续表现为可跳转的已验证来源。

## 4. 总体架构

```text
VS Code commands
  -> src/extension.ts
     -> PaperReaderPanel
        -> ReaderStorage                 existing reading sidecars
        -> TranslationService            existing translation boundary
        -> ResearchStorage               paper research profile
        -> LibraryIndex                  rebuildable cross-paper index
        -> RepositoryService             repository links and snapshots
        -> CodexBridge                    terminal/session handoff
        -> ComparisonService             evidence-based comparison inputs
        -> EvidenceLocatorService        resolve paper + annotation/page evidence targets

Webview
  -> main.tsx                             workflow coordination
     -> PdfDocumentView                  PDF interaction
     -> AnnotationWidgets                existing point-of-reading actions
     -> ReaderActionRegistry             action availability, ordering, invocation contracts
     -> ResearchPanel                    paper profile and repository links
     -> LibraryView                      filtering and paper selection
     -> ComparisonView                   comparison matrix and evidence links

Optional local integration
  -> Inleaf MCP server
     -> read-only access to paper, annotations, library, comparisons, repos
     -> Codex CLI / Codex IDE extension
```

### 4.1 依赖规则

- `extension.ts` 只注册命令和管理激活，不实现论文分类、GitHub 或 Codex 协议。
- `PaperReaderPanel` 只协调会话和跨边界消息，不吸收分类算法、仓库解析或提示词构建。
- `TranslationService` 继续只负责翻译；Codex 问答必须使用独立的 `CodexBridge` 或 `ResearchAssistant` 边界。
- `ResearchStorage` 负责研究档案的原子写入、备份和恢复。
- `LibraryIndex` 是可重建索引；单篇论文侧车是正式来源。
- `ComparisonService` 只组合有来源的数据，不替模型生成无法追溯的结论。
- `ReaderActionRegistry` 只描述动作、可用条件和调用入口；翻译、Codex、存储等实现继续留在各自边界后面。
- `EvidenceLocator` 是跨标注、研究事实、比较和 Codex 上下文共用的稳定合同；PDF 库的运行时对象和 DOM 节点不得进入持久化数据。
- Git、终端、进程、SecretStorage 和网络调用只允许出现在 Extension Host。
- Webview 只管理 UI、PDF 交互和显式用户动作。

### 4.2 阅读动作调用链

```text
selection / saved annotation / reader state
  -> ReaderActionRegistry.getAvailableActions(context)
     -> action renderer at point of reading
        -> typed Webview message
           -> PaperReaderPanel routing only
              -> TranslationService | CodexBridge | ReaderStorage | ResearchStorage
```

每个动作至少定义稳定 `id`、展示位置、排序、`isAvailable(context)`、禁用原因和 typed invocation payload。第一版不需要通用插件运行时，也不允许第三方代码动态注入；目标是消除顶层 UI 中重复的业务条件，并为后续动作形成可测试边界。

## 5. Codex 集成设计

### 5.1 设计选择

Codex 集成按以下优先级实现：

1. **Terminal Bridge：第一版必做。** 复用用户现有 Codex CLI 和交互体验。
2. **MCP Bridge：稳定后实现。** 让 Codex CLI 和 IDE 扩展读取 Inleaf 的结构化上下文。
3. **Embedded Chat：可选后续。** 只有用户明确需要在阅读器内部显示完整对话时，才评估 Codex SDK 或 App Server。

不依赖未公开或不稳定的 Codex VS Code 命令 ID。若无法通过公开接口把提示词写入 Codex IDE composer，则使用 Terminal Bridge 或 MCP，而不是自动化点击第三方扩展 UI。

### 5.2 Terminal Bridge

新增 `CodexBridge`，职责包括：

- 检查 `codex` CLI 是否可用。
- 为当前 PDF 创建或刷新 Codex 上下文 Markdown。
- 创建或复用一个以 PDF 目录为工作目录的 VS Code Terminal。
- 启动交互式 Codex，并附带只读研究提示。
- 保存论文与 Codex session/thread 的轻量关联；不把对话正文写入 GlobalState。
- 将启动失败同时报告给 Webview `stateError` 和 `vscode.window.showErrorMessage`。

不得将原始用户问题拼接进未经安全处理的 shell 命令。优先把动态内容写入上下文文件，并使用固定命令启动 Codex；跨平台命令构造必须覆盖 macOS、Linux 和 Windows。

### 5.3 Codex 上下文合同

生成文件：

```text
.inleaf-reader/
  paper.pdf.codex-context.md
```

建议结构：

```markdown
# Inleaf Reader Paper Context

## Document
- PDF: /absolute/path/to/paper.pdf
- Fingerprint: ...
- Current page: 7

## Current selection
- Locator: document fingerprint + page + normalized rects + quote context
...

## Nearby context
### Before
...
### After
...

## User question
...

## Confirmed paper metadata
...

## Relevant annotations
- Annotation ID + EvidenceLocator + selected text/note
...

## Linked repositories
- URL: ...
- Local checkout: ...
- Commit: ...

## Evidence rules
- Distinguish paper claims, repository evidence, user notes, and inference.
- Cite PDF pages or repository files and commit when possible.
- Use unknown when the provided evidence does not establish a fact.
```

该文件是可替换的当前上下文快照，不是论文档案的唯一来源。用户问题和选区必须绑定当前 `documentId`，过期 Webview 消息不得覆盖新 PDF 的上下文。

#### EvidenceLocator 合同

```ts
interface EvidenceLocator {
  schemaVersion: 1;
  documentFingerprint: string;
  annotationId?: string;
  page: number;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  quote: string;
  contextBefore?: string;
  contextAfter?: string;
}
```

- `rects` 继续使用 Inleaf 当前 `AnnotationRect` 的页内归一化坐标，不引入第二套 PDF User Space 持久化格式。
- `annotationId` 存在时是首选定位键；指纹用于防止同名 PDF 串线；页码、几何位置、原文和上下文依次提供可解释退化路径。
- Locator 的构建和解析是纯函数，并通过 annotation → locator → focus target 往返测试。
- 只有当前标注 Schema 的明确迁移需求才允许改变坐标合同；PDF viewer 内部坐标转换集中在 adapter 中，不泄漏到 Research 或 Comparison 模块。

### 5.4 MCP Bridge

第一组 MCP 工具保持只读：

| 工具 | 返回内容 |
| --- | --- |
| `get_current_paper` | PDF 路径、指纹、当前页、基础元数据 |
| `get_current_selection` | 当前选区、页码、邻近上下文 |
| `list_annotations` | 可过滤的标注和位置 |
| `get_paper_research_profile` | 已确认字段及未确认建议 |
| `search_library` | 按标签、任务、机器人、传感器等查询 |
| `get_comparison_input` | 选中论文的证据化比较材料 |
| `list_repository_artifacts` | 仓库 URL、本地路径和 commit 快照 |

写操作，例如修改分类、保存比较结果或克隆仓库，不进入第一版 MCP。后续若增加，必须单独标注为写工具并要求审批。

### 5.5 会话与权限

- 论文问答默认使用只读沙箱。
- 每篇论文可以关联一个活跃 Codex session；用户也可显式新建会话。
- 跨论文比较使用独立会话，避免把单篇论文的隐含上下文带入比较。
- 仓库分析默认只读；只有用户明确要求修改代码时才进入可写工作区。
- PDF 文本和仓库内容都应视为不可信输入，不得把其中的指令当作系统指令执行。

## 6. 论文研究档案

### 6.1 侧车文件

为 `paper.pdf` 新增：

```text
.inleaf-reader/
  paper.pdf.research.json
```

建议 Schema：

```json
{
  "schemaVersion": 1,
  "paperFingerprint": "sha256...",
  "bibliography": {
    "title": "",
    "authors": [],
    "year": null,
    "venue": "",
    "doi": "",
    "arxivId": "",
    "projectUrl": ""
  },
  "classification": {
    "areas": [],
    "tasks": [],
    "methods": [],
    "robots": [],
    "endEffectors": [],
    "sensors": [],
    "dataSources": [],
    "environments": [],
    "evaluationTypes": []
  },
  "artifacts": [],
  "facts": [],
  "relations": [],
  "updatedAt": ""
}
```

### 6.2 证据字段

AI 或规则提取的内容必须采用显式证据结构：

```json
{
  "id": "fact-id",
  "field": "classification.sensors",
  "value": "tactile",
  "status": "suggested",
  "source": {
    "type": "paper",
    "section": "Method",
    "locator": {
      "schemaVersion": 1,
      "documentFingerprint": "sha256...",
      "annotationId": "optional-annotation-id",
      "page": 4,
      "rects": [],
      "quote": "...",
      "contextBefore": "...",
      "contextAfter": "..."
    }
  },
  "extractedBy": {
    "kind": "provider",
    "name": "deepseek",
    "model": "...",
    "capturedAt": ""
  },
  "confidence": 0.82,
  "createdAt": ""
}
```

`status` 至少支持：

- `suggested`：自动提取，尚未确认。
- `confirmed`：用户确认，可进入默认筛选和比较。
- `rejected`：用户明确拒绝，避免重复建议。
- `unknown`：当前证据无法判断。

`relations` 保存显式关系而不是复制实体，例如研究事实引用某个标注、某个标注被加入某条研究笔记、某个比较单元格引用多个事实。关系至少包含稳定 relation ID、两端实体 ID、关系类型、创建时间；实体删除后必须能显示 dangling/source-missing 状态。第一版只实现实际用户流程需要的关系类型，不建立通用知识图谱运行时。

### 6.3 机器人论文分类维度

默认分类不是封闭枚举；用户可以添加自定义字段。初始推荐维度包括：

- Area：manipulation、locomotion、navigation、HRI、robot learning、active perception。
- Task：grasping、regrasp、in-hand manipulation、assembly、tool use、mobile manipulation。
- Embodiment：robot arm、humanoid、mobile manipulator、dexterous hand、parallel gripper。
- Sensor：RGB、RGB-D、event camera、tactile、force/torque、proprioception。
- Method：planning、optimization、RL、imitation learning、VLA、world model、foundation model。
- Data：simulation、real robot、teleoperation、human video、synthetic、hybrid。
- Evaluation：simulation only、bench test、real robot、user study、public benchmark。

UI 必须允许不同研究方向扩展维度，不能把机器人分类逻辑硬编码进 `main.tsx`。

### 6.4 外部元数据与来源状态

若后续增加 DOI、arXiv、Semantic Scholar、OpenAlex、Crossref 等来源，必须采用字段级 provenance，而不是让最后返回的请求覆盖已有值：

```ts
type SourceOutcome = 'ok' | 'empty' | 'error' | 'notQueried';

interface FieldProvenance {
  source: string;
  sourceRecordId?: string;
  fetchedAt: string;
  outcome: SourceOutcome;
}
```

- 每次聚合返回逐来源 `SourceOutcome`，部分失败仍可显示已有结果，但 UI 必须暴露覆盖范围。
- title、authors、abstract、publication date、PDF URL 等字段分别配置显式来源优先级并单元测试；不得使用一个全局优先顺序替代字段判断。
- DOI 优先作为去重键；缺少 DOI 时的 title/year 退化键只能生成候选匹配，不能自动合并本地论文档案。
- 外部数据先作为 suggestion 或 provenance-bearing metadata；不得自动提升为用户确认事实。
- 该能力属于 Research Profile 之后的可选增强，不是 Ask Codex 或本地标注的前置依赖。

## 7. Library 与跨论文比较

### 7.1 Library Index

用户为论文库选择一个根目录，系统在该目录写入：

```text
library-root/.inleaf-reader/library.index.json
```

索引只包含定位和筛选所需的轻量字段：

```json
{
  "schemaVersion": 1,
  "generatedAt": "",
  "papers": [
    {
      "fingerprint": "",
      "pdfPath": "",
      "researchPath": "",
      "title": "",
      "year": null,
      "tags": [],
      "repositoryCount": 0,
      "updatedAt": ""
    }
  ]
}
```

索引可随时从单篇侧车重建。现有 GlobalState 只保存论文库根目录和轻量定位信息，不保存研究内容。

### 7.2 比较合同

比较维度默认包括：

1. 研究问题与任务定义。
2. 关键假设与适用边界。
3. 机器人平台、末端执行器和传感器。
4. 输入表示、模型结构和控制输出。
5. 训练数据、仿真环境和真实数据比例。
6. 数据集、基线、指标和实验规模。
7. 仿真证据、台架证据与真实机器人证据。
8. 消融实验和失败案例。
9. 代码、数据、权重与许可证。
10. 复现门槛和已知限制。

每个单元格使用以下状态之一：

- `evidenced`：存在可定位来源。
- `inferred`：由多个来源推断，必须显示推断标签。
- `conflicting`：论文、补充材料或仓库证据冲突。
- `unknown`：没有足够证据。

每个非 `unknown` 单元格必须保存 `evidenceRefs`，引用 Research Profile 中的 fact ID、`EvidenceLocator`，或绑定 commit SHA 的仓库文件位置。比较文件不得复制一份无法回溯来源的自由文本作为唯一证据。点击证据时复用 3.6 的定位流程；来源已删除或版本漂移时显示 `sourceMissing` 或 `stale`。

### 7.3 比较输出

```text
.inleaf-reader/comparisons/
  <comparison-id>.json
  <comparison-id>.md
```

JSON 是结构化来源，Markdown 是供人阅读和 AI 使用的导出。比较结果不得覆盖单篇论文的研究档案。

Markdown 导出应为每个结论保留可移植定位信息：论文文件名/指纹、页码、短引文、annotation ID（如有）或仓库 URL/commit/path。VS Code 内部 command URI 可以作为附加便利链接，但不能成为唯一定位方式。

## 8. GitHub 和研究工件

### 8.1 工件类型

`artifacts` 支持：

- `github`
- `git_repository`
- `dataset`
- `model_weights`
- `project_page`
- `supplementary_material`

仓库记录示例：

```json
{
  "id": "artifact-id",
  "type": "github",
  "url": "https://github.com/org/repo",
  "relationship": "official implementation",
  "verification": {
    "status": "confirmed",
    "sourceType": "paper",
    "page": 1
  },
  "localCheckout": {
    "path": "",
    "commit": "",
    "dirty": null,
    "capturedAt": ""
  },
  "license": "",
  "notes": ""
}
```

### 8.2 仓库分析边界

- 自动识别到的链接先作为候选，用户确认后才能标记为官方工件。
- “README 声称可运行”不等于依赖安装成功或机器人实验通过。
- “存在仿真配置”不等于真实机器人支持。
- 仓库分析必须附带 commit SHA；未固定版本的结论标记为可能漂移。
- 私有仓库凭据不得写入研究侧车或日志。
- Clone、checkout、submodule 初始化和大文件下载都必须由用户显式触发。

## 9. DeepSeek 翻译设计

### 9.1 现有实现

当前 `TranslationService` 已经：

- 从 VS Code SecretStorage 读取 DeepSeek API Key。
- 调用 `POST https://api.deepseek.com/chat/completions`。
- 支持 `deepseek-v4-flash` 和 `deepseek-v4-pro`。
- 使用学术翻译 system prompt。
- 使用 `thinking: { "type": "disabled" }`、非流式响应和超时处理。
- 将 401、网络、超时和无效响应转换为用户可理解的错误。

### 9.2 保持的安全规则

- API Key 只能从 VS Code 的密码输入框进入 SecretStorage。
- API Key 不得进入 settings JSON、Webview、侧车、日志、错误详情或遥测。
- 只发送用户主动选择并点击翻译的文本。
- UI 必须清楚标识当前提供商与远程发送行为。
- 翻译结果仍绑定源文本和 `documentId`，过期结果不得覆盖新选区。

### 9.3 待验证和改进

- 使用真实用户 Key 验证 Flash 和 Pro 的成功路径。
- 验证无余额、401、429、服务端错误、超时和断网路径。
- 验证公式、引用、段落和术语保持效果。
- 增加取消尚未完成翻译的能力。
- 评估流式翻译，但不得为流式输出牺牲 stale-result 防护。
- 明确单词优先 ECDICT 的 UI 提示，并增加可选覆盖设置。

DeepSeek 翻译与 Codex 论文对话保持两个独立边界。不得因为用户配置了 DeepSeek 翻译，就自动把 Codex 问答或论文分类也发送到 DeepSeek。

## 10. Webview 与交互设计

### 10.1 阅读位置动作

第一版引入轻量动作合同，而不是通用插件系统：

```ts
type ReaderActionLocation = 'selection-primary' | 'selection-more' | 'annotation-inline';

interface ReaderActionDefinition<Context, Payload> {
  id: `inleafReader.action.${string}`;
  location: ReaderActionLocation;
  order: number;
  label: string;
  isAvailable(context: Context): boolean;
  disabledReason?(context: Context): string | undefined;
  buildPayload(context: Context): Payload;
}
```

- Registry 决定动作身份、顺序、可用条件和 payload；React 组件只负责渲染和收集必要输入。
- 动作执行仍通过判别联合消息进入既有 Extension Host 边界，不允许 registry 保存服务实例或绕过 `PaperReaderPanel`。
- 高频、低延迟动作进入 `selection-primary`；低频动作进入 `selection-more`，不得因能力增加而持续拉长主工具条。
- 同一能力在选区和已保存标注附近出现时复用同一个 action ID 和可用性规则，但可以使用不同 renderer。
- 远程或外部动作必须能解释禁用原因，例如 Codex CLI 不可用、远程翻译未 opt-in；不可用动作不得诱导自动配置或自动打开面板。

选区工具条建议顺序：

```text
高亮 | 下划线 | 笔记 | 翻译 | 询问 Codex
```

- `Translate` 继续复用现有单一翻译动作。
- `Ask Codex` 打开紧凑问题输入或直接使用快捷意图。
- 两者都不得自动打开右侧面板。
- 选区中的原始 OCR/文本错误在写入标注或上下文前仍可编辑。
- 当可用宽度不足时，保留 Highlight、Note、Translate 等高频动作，并把较低优先级动作收进 `More`；具体排序通过行为观察和人工 QA 调整，不照搬参考仓库的桌面 PDF 编辑器工具栏。

### 10.2 右侧面板

现有标签：

```text
Overview | Annotations | Wordbook | Translation
```

新增：

```text
研究 | 代码仓库
```

面板保持用户主动打开、启动时隐藏。Library 和跨论文比较属于独立视图或命令，不应把单篇阅读侧栏变成拥挤的全局管理器。

### 10.3 Workbench 界面层级

界面借鉴 UniLab Workbench 的“操作壳层”而不复用其品牌、资产或实验状态语义：

```text
Inleaf 功能轨 | PDF 阅读器 + 论文命令栏 | 用户主动打开的论文检查器
            | local-data status bar
               | 文库 / 跨论文比较工作区（显式打开时）
```

- 左侧窄功能轨始终提供 `阅读 / 标注 / 研究 / 仓库 / 文库 / 对比 / 设置`，并使用 `阅 / 记 / 研 / 仓 / 库 / 比 / 设` 作为紧凑图标，解决能力已实现但难发现的问题。
- 顶部第一层显示当前论文和 Codex、本地侧车、Library 等就绪状态；第二层只保留分页、缩放和 Inspector 开关等阅读控制。
- 底部状态栏只显示本地数据、当前页和当前论文指纹等低干扰信息，不伪装成后台服务成功状态。
- Paper Inspector 仍在启动时隐藏；选择翻译、保存标注和点击普通阅读动作不得自动打开它。
- Library 使用论文、仓库、标签和当前选择的概览指标；Comparison 显式汇总 `evidenced / inferred / conflicting / unknown`，避免视觉美化掩盖证据边界。
- 颜色、字体和交互状态使用 VS Code Theme 变量，自适应亮色和深色主题；窄窗口中 Inspector 退化为用户主动打开的右侧覆盖层。

### 10.4 状态反馈

下列结果必须同时进入 Webview 状态和 VS Code 用户提示：

- Codex CLI 不可用或启动失败。
- 上下文文件写入失败。
- 研究侧车损坏或恢复失败。
- 仓库 URL 无效、clone 失败或版本快照失败。
- DeepSeek 翻译失败。
- Library 索引部分失效或包含已移动 PDF。

## 11. 建议代码边界

### 11.1 Extension Host

| 文件 | 职责 |
| --- | --- |
| `src/researchTypes.ts` | 研究档案、证据、工件与比较类型 |
| `src/researchStorage.ts` | `research.json` 原子读写、备份与迁移 |
| `src/libraryIndex.ts` | 扫描、增量更新和重建 Library 索引 |
| `src/repositoryService.ts` | URL 校验、用户确认后的 clone、commit 快照 |
| `src/codexBridge.ts` | Codex 可用性、上下文生成、Terminal 会话 |
| `src/comparisonService.ts` | 构建证据化比较输入与导出 |
| `src/evidenceLocator.ts` | 解析文档指纹、annotation ID 与退化定位目标 |
| `src/researchMessages.ts` | 新增跨边界消息的判别联合类型 |

`PaperReaderPanel` 只持有这些服务并转发消息。纯格式化、分类归一化和比较排序逻辑应可独立单元测试。

### 11.2 Webview

| 文件 | 职责 |
| --- | --- |
| `webview/src/components/AskCodexActions.tsx` | 选区问题与快捷意图 |
| `webview/src/components/ResearchPanel.tsx` | 单篇论文研究档案 |
| `webview/src/components/RepositoryPanel.tsx` | 工件关联与状态展示 |
| `webview/src/components/LibraryView.tsx` | 全局筛选和多选 |
| `webview/src/components/ComparisonView.tsx` | 比较矩阵与证据跳转 |
| `webview/src/readerActions.ts` | 轻量 Action Registry、可用性与排序规则 |
| `webview/src/evidenceLocator.ts` | Annotation/selection 与持久化 Locator 的纯转换 |
| `webview/src/researchModel.ts` | 纯分类、证据和显示转换 |

只有在这些模块形成明确边界时才创建文件；简单逻辑不应被拆成大量微型模块。

Nexus 把 reader 物理拆成独立 package 的做法只作为边界验证参考。Inleaf 第一阶段先通过接口、纯转换和回归测试证明边界；只有 viewer 需要被多个宿主复用，或现有双 TypeScript 项目无法保持依赖方向时，才评估独立 package。

## 12. 并发、恢复与性能

- 所有新消息必须携带 `documentId`。
- 切换 PDF 后，旧论文的分类提取、翻译或 Codex 上下文生成结果不得写入当前论文。
- `research.json` 使用与现有 JSON 一致的串行 mutation queue、临时文件原子替换和 `.bak`。
- Library 扫描在后台增量进行，不在滚动、页面渲染或选区处理器中同步遍历文件系统。
- 比较结果只加载所选论文，不能默认把整个论文库送入 Webview 或模型。
- Git 状态、仓库元数据和远程信息使用缓存，并附带采集时间。
- 对 PDF 文本抽取和自动分类进行取消与过期检测。
- Action Registry 定义保持静态；可用性只从当前会话的轻量 context 派生，不在滚动、缩放或页面渲染事件中重建服务和组件树。
- `EvidenceLocator` 的 quote/context 退化搜索只在用户显式跳转且 ID/几何定位失败时执行，并复用现有懒加载文本层缓存；不得恢复同步全页几何扫描。
- 多来源元数据请求必须可取消并保留逐来源 outcome；一次来源失败不得清空其他已验证结果或覆盖用户确认字段。

## 13. 隐私与安全

- DeepSeek 是远程提供商，只有显式翻译动作可发送文本。
- Codex 的工作目录和沙箱权限必须在启动前明确；论文问答默认只读。
- 任何未来的自动论文分类都必须显示使用的提供商和将发送的内容范围。
- 不自动发送整篇 PDF；优先发送当前选区、附近上下文和用户确认的研究档案。
- 论文、网页和仓库中的提示文本均视为不可信数据，不能改变系统安全规则。
- 仓库 URL、文件名和论文文本不得直接进入未转义 shell 命令。
- 用户可删除研究档案、比较结果和 Codex 上下文文件，不影响原始 PDF。
- 不采集论文内容、问题、翻译文本、API Key 或仓库凭据作为遥测。

## 14. 实施阶段与验收标准

### Phase 0：验证现有 DeepSeek 翻译

工作：

- 修复本地 Node/依赖验证环境。
- 运行 `npm test`。
- 使用真实 DeepSeek Key 完成 Flash 和 Pro 人工测试。
- 覆盖 401、429、超时、断网和取消路径。

验收：

- API Key 只存在于 SecretStorage。
- 句子翻译结果正确绑定源文本与文档会话。
- 单词仍默认走 ECDICT。
- 错误同时到达 Webview 和 VS Code 用户提示。

### Phase 1：Ask Codex Terminal Bridge

工作：

- 先定义 `ReaderActionRegistry`，将现有 Highlight、Underline、Note、Translate 迁入 registry 并保持行为不变。
- 新增 `Ask Codex` 选区动作和问题输入。
- 新增上下文 Markdown 生成器。
- 新增 `EvidenceLocator` 构建、序列化和 focus 消息合同。
- 新增 Codex CLI 检测、Terminal 创建与复用。
- 为每篇论文维护轻量会话关联。

验收：

- 从 PDF 选区两次点击内进入可追问 Codex 会话。
- Codex 可看到 PDF 路径、页码、选区、附近上下文和用户问题。
- 四个既有选区动作迁移后交互、保存结果和侧栏隐藏行为不变；新增动作不要求修改 SelectionToolbar 的业务分支。
- Action 顺序、可用性、禁用原因和 typed payload 有独立单元测试。
- Codex 上下文中的 Locator 能从 annotation ID 或页码/位置重新聚焦原证据；错误文档指纹被拒绝。
- 快速切换两篇 PDF 时上下文不串线。
- CLI 缺失或启动失败有明确恢复建议。
- 用户动态文本不会形成 shell 注入。

### Phase 2：Research Profile 与仓库关联

工作：

- 定义并实现 `research.json` Schema。
- 增加 Research 和 Repositories 面板。
- 支持手动分类、候选建议确认和 GitHub URL 关联。
- 支持 Research fact、annotation 与 note 的显式 relation，并显示 source-missing 状态。
- 支持仓库 commit 快照；clone 保持用户确认。
- 若增加外部论文元数据，先实现逐来源 outcome、字段优先级和 provenance；外部请求保持可选。

验收：

- 分类与仓库关系在重启后恢复。
- 并发写入不会丢失字段。
- 已有目的地数据不会被迁移或恢复覆盖。
- 自动建议与用户确认字段在 UI 和数据中可区分。
- relation 只引用既有实体，不产生第二份互相漂移的标注正文；删除来源后可检测 dangling reference。
- 单个外部来源失败不会伪装为全局空结果，也不会覆盖用户确认字段。

### Phase 3：Library 与筛选

工作：

- 用户选择论文库根目录。
- 构建可重建索引和增量刷新。
- 支持机器人研究维度筛选、搜索和多选。

验收：

- 移动或重命名 PDF 后可通过指纹恢复关联。
- 索引损坏可从单篇侧车重建。
- GlobalState 不包含论文研究正文。
- 大型论文目录扫描不阻塞阅读器滚动和缩放。

### Phase 4：跨论文比较

工作：

- 实现比较维度选择和矩阵视图。
- 支持证据跳转、冲突与 unknown 状态。
- 导出 JSON 和 Markdown。
- 增加 `Analyze comparison with Codex`。

验收：

- 每个非 unknown 单元格都有页码、标注或仓库 commit 来源。
- 所有 evidence link 都能跳回原标注/页内位置，或明确显示 source-missing/stale 原因。
- AI 推断明确标记为 inferred。
- 导出文件可被外部 AI 独立读取。
- 比较结果不反向覆盖单篇论文档案。

### Phase 5：只读 Inleaf MCP Bridge

工作：

- 提供只读 MCP 工具。
- 为 Codex CLI 和 IDE 提供明确的一次性配置流程。
- 增加工具级输入校验、超时与审计输出。

验收：

- Codex CLI 和 IDE 能查询同一论文库配置。
- MCP 不可修改 PDF、侧车或仓库。
- 用户可以禁用或移除 MCP 集成。
- MCP 不可用时，Reader 和 Terminal Bridge 仍正常工作。

### Phase 6：可选的 Embedded Chat

仅当 Terminal 和 MCP 仍不能满足阅读连续性时评估：

- Codex SDK thread 生命周期。
- App Server 的 stdio 协议、流式事件和审批 UI。
- 可移植对话导出。
- 与现有 Codex 登录和权限模型的兼容性。

此阶段不是前五阶段的发布阻塞项。

## 15. 测试计划

### 15.1 单元与合同测试

- 研究档案 Schema 默认值、迁移和未知字段兼容。
- 研究档案并发写入、原子替换和 `.bak` 恢复。
- Codex 上下文生成的字段完整性和 Markdown 转义。
- Action Registry 的稳定 ID、排序、可用性、禁用原因和 payload 构建。
- 既有 Highlight、Underline、Note、Translate 通过 registry 调用后的行为回归。
- `EvidenceLocator` 的 selection/annotation 往返、错误指纹拒绝、ID 缺失后的逐级退化和 source-missing。
- Webview 与 Extension Host 新消息的 `documentId` 约束。
- Library 索引重建、去重、移动恢复和损坏处理。
- 分类标签归一化和用户确认状态转换。
- fact/annotation/note relation 的同文档约束、dangling reference 检测和删除行为。
- 多来源元数据逐来源 outcome、字段级优先级、DOI 去重和 title/year 候选匹配。
- 比较状态：evidenced、inferred、conflicting、unknown。
- 仓库 URL 校验、commit 快照和 clone 目标保护。
- DeepSeek 成功、401、429、超时、网络失败和 stale result。

### 15.2 人工 QA

- 正常文本 PDF 中选区并启动 Codex，连续追问两轮。
- 在窄宽度和正常宽度下检查选区动作排序与 `More` 收纳，确认新增动作没有挤压高频操作。
- 快速切换两篇 PDF，确认 Codex 上下文、进度和侧车不串线。
- 从 Research fact、比较单元格和导出 Markdown 分别返回原标注；再删除来源标注，确认显示 source-missing 而非错误定位。
- 创建、修改、拒绝和确认分类建议。
- 关联一个官方仓库和一个非官方复现仓库，确认关系显示不同。
- 比较至少三篇机器人论文并跳回证据位置。
- 在干净与 dirty 仓库中查看快照，确认不会擅自改动或清理工作树。
- 使用 DeepSeek Flash、Pro、错误 Key 和断网状态翻译。
- 隐藏侧栏后完成高亮、翻译和 Ask Codex，确认侧栏不会自动出现。

### 15.3 发布门槛

- `npm test` 通过。
- 使用真实文本 PDF 完成人工 QA。
- 构建并检查 VSIX。
- 确认生成的 `media/` 运行资产已更新。
- 确认 VSIX 只包含一个公开 README。
- 确认没有用户 PDF、`.inleaf-reader/` 数据、API Key、仓库凭据或 VSIX 文件进入提交。

## 16. 风险与默认决策

| 风险 | 默认决策 |
| --- | --- |
| Codex IDE 没有公开的 composer 注入接口 | 使用 Terminal Bridge 和 MCP，不依赖内部命令 ID |
| PDF 全文过大或包含无关内容 | 默认只传选区、附近上下文、已确认档案和相关标注 |
| AI 分类产生幻觉 | 候选字段必须确认；缺证据使用 unknown |
| 仓库随时间变化 | 所有分析绑定 commit SHA 和采集时间 |
| 自动 clone 带来磁盘与安全风险 | 只允许用户显式确认后 clone |
| Library 索引损坏 | 索引可从单篇侧车重建 |
| 远程提供商泄露文本 | 明确 opt-in，并显示发送范围和提供商 |
| `main.tsx` 继续膨胀 | 将研究 UI 和纯规则提取到有意义的边界 |
| Action Registry 演变成通用插件平台 | 第一版只注册内置动作和 typed payload，不支持动态第三方代码 |
| 参考 PDF reader 的高级功能诱发引擎迁移 | 维持现有 PDF.js worker 与 highlighter 边界；只有独立 ADR、基准和人工 QA 才能改变 |
| Locator Schema 与 viewer 内部坐标耦合 | 持久化沿用归一化 AnnotationRect，所有运行时坐标转换集中在 adapter |
| 外部元数据部分失败被误报为“无结果” | 返回逐来源 outcome 与字段 provenance，保留其他来源和用户确认值 |
| 参考仓库设计文档与代码漂移 | 固定参考 commit，引用模式而非复制实现；实施以 Inleaf 测试和合同为准 |
| MCP 或 Codex 不可用 | 阅读、标注、离线词典和翻译能力保持独立 |

## 17. 仍需产品确认的问题

以下问题不阻塞 Phase 0 和 Phase 1，可在实现中通过保守默认值推进：

1. Codex 会话是默认每篇论文一个，还是每个用户问题一个？默认：每篇论文一个，可手动新建。
2. Library 根目录是否允许多个？默认：允许多个，每个根目录独立索引。
3. 自动分类使用 DeepSeek、Codex 还是仅手动？默认：先手动与规则提取；远程 AI 分类后续显式开启。
4. 仓库 clone 默认目录在哪里？默认：由用户每次选择，不写入扩展目录。
5. 比较模板是否只针对机器人？默认：提供机器人模板，同时允许自定义维度。
6. 是否保存完整 Codex 对话？默认：只保存 session 关联和用户主动导出的 Markdown，不复制内部完整 transcript。
7. 是否在 Research Profile 阶段自动查询外部学术来源？默认：不自动；用户显式触发后才查询，并显示来源、发送的 identifier 和逐来源 outcome。
8. 是否为了高级标注迁移 PDF 引擎？默认：否；维持现有引擎，只有单独批准的 ADR 和验证证据才能改变。

## 18. 外部设计依据与参考实现审计

- [Codex IDE extension](https://developers.openai.com/codex/ide)：Codex 可使用编辑器中的文件和选区上下文。
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference)：交互式 CLI、可选初始提示和会话恢复。
- [Codex MCP](https://developers.openai.com/codex/mcp)：Codex CLI 与 IDE 扩展支持 MCP，并共享本地配置。
- [Codex SDK](https://developers.openai.com/codex/sdk)：可程序化启动、继续和恢复 Codex thread。
- [Codex App Server](https://developers.openai.com/codex/app-server)：适用于带认证、历史、审批和流式事件的深度客户端集成。
- [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)：当前翻译请求使用的 API 格式与模型参数。

### 18.1 Nexus 参考快照

本次参考固定到 Nexus `main` 的 commit [`5f198b3`](https://github.com/ha0xin/nexus/commit/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca)（2026-03-23）。参考结论如下：

- [commands](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/pdf-reader/src/config/commands.ts) 与 [UI schema](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/pdf-reader/src/config/ui-schema.ts) 证明动作身份和界面布局可以解耦；Inleaf 只采用轻量内置 Action Registry，不采用完整编辑器工具栏。
- [PDF viewer](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/pdf-reader/src/components/pdf-viewer.tsx)、[anchor adapter](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/pdf-reader/src/adapters/anchor-adapter.ts) 和 [annotation event bridge](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/pdf-reader/src/bridges/annotation-event-bridge.tsx) 证明 viewer runtime、持久化模型和宿主回调应隔离；Inleaf 保留现有引擎，只加强 adapter 合同。
- [annotation-note schema](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/packages/shared/src/schema/core.ts) 与 [annotation deep-link route state](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/apps/web/src/lib/reader-route-state.ts) 支持显式关系和稳定返回原文；Inleaf 以侧车 relation + `EvidenceLocator` 实现相同产品价值。
- [metadata merge](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/apps/api/src/lib/metadata-merge.ts) 与 [multi-source search](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/apps/api/src/routes/search.ts) 提供字段优先级、去重和逐来源状态的参考；Inleaf 将其作为可选元数据增强，而非阅读前置依赖。
- [PDF engine ADR](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/docs/decisions/004-pdf-engine-selection.md) 的迁移动因是写回 PDF、Ink、形状标注和字符级精度。这些不是 Inleaf 当前已证明的阻塞项，因此不能据此启动引擎迁移。
- [Paper AI implementation plan](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/docs/superpowers/plans/2026-03-17-paper-ai-analysis.md) 在该快照中仍是计划，不作为成熟 AI 实现证据。Inleaf 的 AI 路径继续优先交给用户已有的 Codex，而不是复制一个内置远程分析服务。

### 18.2 许可与复制边界

Nexus [README](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/README.md) 标记 `License: Private`，而根 [package.json](https://github.com/ha0xin/nexus/blob/5f198b3ea9ff2862c779bd1a9e92591eb64e3dca/package.json) 声明 MIT，且该快照根目录没有 LICENSE 文件。许可表述不一致，因此本计划只吸收可独立表达的架构思想和产品模式；不得复制 Nexus 源码、图标、样式或专有内容，除非仓库所有者明确许可并完成第三方许可审查。
