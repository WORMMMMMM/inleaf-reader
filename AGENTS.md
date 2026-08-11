# AGENTS.md

This repository is the VS Code extension **Inleaf Reader**, with the Chinese tagline **“进入书本，进入心流”**. Its goal is a stable, convenient reader with automatic local persistence, annotation, translation, and vocabulary capture. Prefer practical reliability over originality.

Keep the public product name as `Inleaf Reader`, but preserve the internal extension id `ziming.reading-extension`, command ids under `readingExtension.*`, settings namespace `readingExtension`, asset filenames, and `.reading-extension/` sidecar directory so existing installations and reading data continue to work.

## Product Goal

- Build a usable VS Code PDF reader for papers and books.
- Keep annotation data, vocabulary, and reading progress in sidecar files next to the PDF so they can sync through Git or any file-sync tool.
- Let the user work beside VS Code AI extensions such as Codex, Claude Code, or ChatGPT extensions.
- Avoid paid AI API dependencies by default. DeepSeek is optional and must use
  a user-provided key stored through VS Code SecretStorage.

## Architecture Rules

- Do not rebuild a custom PDF renderer unless there is no alternative. PDF rendering, text selection, text layer behavior, scrolling, zooming, and highlight positioning should stay delegated to `react-pdf-highlighter-plus`.
- The extension host owns file access, clipboard access, local translation process calls, optional AI API calls, SecretStorage access, and sidecar persistence.
- The Webview owns reader UI, PDF interaction, annotation editing controls, wordbook controls, and `postMessage` events back to the extension host.
- Selection actions are unified around `Translate`: a single English word returns dictionary details and a `Save to Wordbook` action; multi-word text returns sentence translation. Do not add a separate `Word` selection entry point.
- The right-side panel is user-invoked only and hidden on reader startup. Annotation editing, translation, and word saving must not open it automatically. Clicking a saved PDF highlight opens the inline annotation editor next to that highlight.
- Extension-host errors from message handlers must be surfaced to both the Webview (via `stateError` messages) and the VS Code notification API (`vscode.window.showErrorMessage`).
- Runtime user data belongs in `.reading-extension/` next to the PDF, not in VS Code global storage. VS Code global storage may contain only a lightweight PDF-content-fingerprint-to-path index used to recover sidecars after a file is moved or renamed; never store annotations, vocabulary, or progress there.
- Preserve backward compatibility for existing annotation JSON whenever possible.

## Important Files

- `src/extension.ts`: Registers reader and DeepSeek credential commands. DeepSeek keys are accepted through a password input and stored only in VS Code SecretStorage.
- `src/paperReaderPanel.ts`: Creates the Webview, injects resources/config on first open, handles document-session-tagged Webview messages, calls local or DeepSeek translation, and delegates storage. When switching PDFs, it sends a `navigateTo` message to the existing Webview instead of rebuilding the HTML. All message handlers are wrapped in try/catch so filesystem errors surface to both the Webview status bar and a VS Code error notification. Argos sentence translation runs through a long-lived daemon process.
- `src/readerStorage.ts`: Reads/writes annotations, wordbook, progress, Markdown export, and annotated PDF export. JSON mutations are serialized, written through atomic temp-file replacement, and retain the previous version as `.bak`. On first access it uses the PDF identity index to copy missing sidecars from a previously known path without overwriting current data.
- `src/ecdictClient.ts` and `src/ecdictWorker.ts`: Lazy background Node worker for the bundled ECDICT dictionary. Single-word lookup must remain independent of Python and Argos.
- `src/pdfIdentity.ts`: Computes a sampled PDF content fingerprint and defines the lightweight location index and sidecar path mapping used for move/rename recovery.
- `src/annotationTypes.ts`: Shared persisted data types. Update this carefully when changing the annotation schema.
- `src/annotationExports.ts`: Markdown and annotated PDF export logic.
- `webview/src/main.tsx`: React reader UI and PDF/highlight integration. Handles `navigateTo` messages for in-place PDF switching, `stateError` messages for surfaced extension-host errors, and `wordDetails` in translation results for dictionary display.
- `webview/src/styles.css`: Reader layout and visual styling, including dictionary result block.
- `webview/src/vscodeApi.ts`: Webview access to VS Code API and injected config.
- `scripts/argos_translate.py`: One-shot Argos Translate helper. Reads JSON from stdin and writes JSON to stdout. Kept as a fallback.
- `scripts/argos_translate_daemon.py`: Long-lived sentence-translation daemon. Loads Argos once and matches responses by explicit request id; it does not load ECDICT.
- `scripts/ecdict_compact.json`: Optional uncompressed ECDICT output used only for inspection; do not commit it.
- `scripts/ecdict_compact.json.gz`: Gzipped compact ECDICT dictionary (~22MB, 770,611 entries) used by the Node dictionary worker and committed for offline distribution.
- `scripts/test-annotation-exports.mjs`: Regression tests for exports and schema compatibility.
- `media/reader-app.js`, `media/reader-app.css`, and `media/reader-pdf_viewer.js`: Generated Webview assets. Do not edit manually; rebuild with `npm run build:webview` or `npm run compile`.
- `media/pdfjs-dist/`: Generated runtime copy of the PDF.js Web Worker, CMaps, and standard fonts. Rebuilt from `node_modules/pdfjs-dist` by `npm run copy:pdfjs-assets` as part of `npm run compile`.
- `project_map.md`: File-by-file repository map. Update it when adding or changing major files.

The `readingExtension.openReader` command uses the theme-specific custom SVGs in `assets/reading-extension-toolbar-light.svg` and `assets/reading-extension-toolbar-dark.svg` so its `editor/title` menu contribution shows the nested-book brand mark. Keep the full command title for the Command Palette and hover tooltip.

## Runtime Data Contract

For `paper.pdf`, the extension writes:

```text
.reading-extension/
  paper.pdf.annotations.json
  paper.pdf.annotations.md
  paper.pdf.annotated.pdf
  paper.pdf.wordbook.json
  paper.pdf.progress.json
```

These files are intentionally plain local files. They should remain portable across machines.
Atomic JSON updates may also leave `*.json.bak` recovery copies next to active sidecars.

## Local Translation

- Default provider: Argos Translate through `.venv-translate/bin/python`.
- Dictionary: `src/ecdictWorker.ts` lazily decompresses ECDICT off the extension-host main thread. It requires neither Python nor Argos.
- Daemon: `scripts/argos_translate_daemon.py` runs as a long-lived process for sentence translation. It loads Argos once, serves JSON-line requests, and echoes request ids. The extension host manages daemon lifecycle automatically.
- Fallback: `scripts/argos_translate.py` (one-shot mode, kept for backward compatibility).
- Dictionary: Single English words are detected automatically (`/^[a-zA-Z'-]+$/`) and looked up in the compact ECDICT data (`scripts/ecdict_compact.json.gz`, generated from the MIT-licensed upstream ECDICT CSV). Dictionary results include phonetics, Chinese definitions, English definitions, part-of-speech labels, and word forms when available. Non-word text falls through to neural translation.
- Current expected offline package: `en -> zh`.
- LibreTranslate remains available as an HTTP fallback through `readingExtension.libreTranslateEndpoint`.
- Argos quality is usable but limited.
- Do not commit `.venv-translate/`; it is a local runtime dependency.

## DeepSeek Translation

- Optional provider: DeepSeek's OpenAI-compatible Chat Completions endpoint.
- Default model: `deepseek-v4-flash` with thinking disabled for lower-latency translation.
- API keys must be stored through `Inleaf Reader: Set DeepSeek API Key`.
- The Translation sidebar lets users switch directly between local translation
  and DeepSeek AI translation, and opens the secure key input when needed.
- Never put API keys in `package.json`, VS Code settings, sidecar files, logs, or the Webview.
- Single English words continue to prefer the local ECDICT dictionary so structured word details and `Save to Wordbook` remain available.

## Development Commands

Run these before committing code changes:

```bash
npm test
./node_modules/.bin/tsc -p tsconfig.webview.json --noEmit
node --check media/reader-app.js
```

`npm run test:unit` and `npm run typecheck` are the faster inner-loop checks;
`npm test` runs the full compile and validation pipeline.

Use:

```bash
npm run compile
```

to rebuild the Webview bundle and PDF.js runtime assets under `media/`, compile
testable CommonJS modules under `out/`, and bundle the extension entrypoint with
its Node dependencies into `out/extension.js`.

## Manual Checks

For reader changes, manually verify at least one normal text PDF:

- PDF opens without a blank Webview.
- Page scale is reasonable at initial load.
- Text selection works with real text PDFs.
- Creating, editing, deleting, and undoing annotations autosaves.
- Clicking an existing text highlight opens an inline editor near the PDF content; saving and cancelling must work without showing the right-side panel. The original selected text remains editable so OCR mistakes can be corrected.
- Closing and reopening restores annotations, wordbook entries, and progress.
- Saved words can be viewed and deleted from the Wordbook tab.
- `Translate locally` returns a result for English selected text in <1s after first call.
- Selecting a single English word and clicking `Translate locally` shows dictionary entry with phonetic, Chinese definitions, and English definitions.
- Selecting a sentence and clicking `Translate` shows sentence translation without wordbook controls.
- With DeepSeek configured, selecting a sentence and clicking `Translate` returns an AI translation without exposing the key to the Webview.

For scanned PDFs, text selection may not work because there is no text layer. Do not treat that as a regression unless OCR has been added.

## Git Hygiene

Do not commit:

- `.vscode/`
- `.venv-translate/`
- `node_modules/`
- `out/`
- user PDFs
- runtime `.reading-extension/` sidecar data
- packaged `*.vsix` files
- `scripts/ecdict_compact.json` (large generated file, keep only the gzipped version)
- `scripts/ecdict.csv` (downloaded source CSV)

Generated `media/reader-app.js`, `media/reader-app.css`, `media/reader-pdf_viewer.js`, and `media/pdfjs-dist/pdf.worker.min.mjs` should be committed when their sources change, because the extension loads them at runtime.

The generated dictionary gzip (`scripts/ecdict_compact.json.gz`) should be committed so the dictionary works without an internet connection. Rebuild it with `python3 scripts/build_ecdict_compact.py`.

## Known Design Priorities

- Stability first.
- Auto-save first.
- Sync-friendly sidecar files first.
- Keep AI integration optional and cheap.
- Avoid large refactors unless they directly improve reader stability or maintainability.
- Large-PDF scrolling: keep PDF parsing and image decoding in the packaged PDF.js Web Worker. Do not reintroduce the in-bundle fake worker.
- VS Code Webviews cannot reliably start a module Worker directly from an extension-resource URL. Fetch the packaged PDF.js worker, wrap its bytes in a JavaScript `Blob`, and pass the resulting `blob:` URL to `PdfLoader`.
- Keep synchronous text-layer geometry scans out of page-render and scroll handlers. Selection-region analysis should run lazily when a selection starts and remain cached on that text layer.
- Webview state preservation: use `retainContextWhenHidden: true` and in-place `navigateTo` messaging rather than rebuilding HTML when switching PDFs.
- Translation speed: use a long-lived daemon process. Never spawn a one-shot Python process per translation request in the normal code path.
