# AGENTS.md

This repository is a VS Code extension for a personal paper-reading workflow. Its goal is a stable, convenient reader with automatic local persistence, annotation, translation, and vocabulary capture. Prefer practical reliability over originality.

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
- Extension-host errors from message handlers must be surfaced to both the Webview (via `stateError` messages) and the VS Code notification API (`vscode.window.showErrorMessage`).
- Runtime user data belongs in `.reading-extension/` next to the PDF, not in VS Code global storage. VS Code global storage may contain only a lightweight PDF-content-fingerprint-to-path index used to recover sidecars after a file is moved or renamed; never store annotations, vocabulary, or progress there.
- Preserve backward compatibility for existing annotation JSON whenever possible.

## Important Files

- `src/extension.ts`: Registers reader and DeepSeek credential commands. DeepSeek keys are accepted through a password input and stored only in VS Code SecretStorage.
- `src/paperReaderPanel.ts`: Creates the Webview, injects resources/config on first open, handles Webview messages, calls local or DeepSeek translation, and delegates storage. When switching PDFs, it sends a `navigateTo` message to the existing Webview instead of rebuilding the HTML. All message handlers are wrapped in try/catch so filesystem errors surface to both the Webview status bar and a VS Code error notification. Local translation runs through a long-lived daemon process for speed; single English words trigger dictionary lookup via ECDICT.
- `src/readerStorage.ts`: Reads/writes annotations, wordbook, progress, Markdown export, and annotated PDF export. On first access it uses the PDF identity index to copy missing sidecars from a previously known path without overwriting current data.
- `src/pdfIdentity.ts`: Computes a sampled PDF content fingerprint and defines the lightweight location index and sidecar path mapping used for move/rename recovery.
- `src/annotationTypes.ts`: Shared persisted data types. Update this carefully when changing the annotation schema.
- `src/annotationExports.ts`: Markdown and annotated PDF export logic.
- `webview/src/main.tsx`: React reader UI and PDF/highlight integration. Handles `navigateTo` messages for in-place PDF switching, `stateError` messages for surfaced extension-host errors, and `wordDetails` in translation results for dictionary display.
- `webview/src/styles.css`: Reader layout and visual styling, including dictionary result block.
- `webview/src/vscodeApi.ts`: Webview access to VS Code API and injected config.
- `scripts/argos_translate.py`: One-shot Argos Translate helper. Reads JSON from stdin and writes JSON to stdout. Kept as a fallback.
- `scripts/argos_translate_daemon.py`: Long-lived translation daemon with dictionary support. Loads Argos Translate model and ECDICT dictionary once at startup, then serves requests as JSON lines over stdin/stdout. Supports `mode: "translate"` and `mode: "dict"`.
- `scripts/ecdict_compact.json`: Optional uncompressed ECDICT output used only for inspection; do not commit it.
- `scripts/ecdict_compact.json.gz`: Gzipped compact ECDICT dictionary (~22MB, 770,611 entries) used by the daemon for single-word lookups and committed for offline distribution.
- `scripts/test-annotation-exports.mjs`: Regression tests for exports and schema compatibility.
- `media/reader-app.js` and `media/reader-app.css`: Generated Webview bundle. Do not edit manually; rebuild with `npm run build:webview` or `npm run compile`.
- `media/pdfjs-dist/`: Generated runtime copy of PDF.js CMaps and standard fonts. Rebuilt from `node_modules/pdfjs-dist` by `npm run copy:pdfjs-assets` as part of `npm run compile`.
- `project_map.md`: File-by-file repository map. Update it when adding or changing major files.

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

## Local Translation

- Default provider: Argos Translate through `.venv-translate/bin/python`.
- Daemon: `scripts/argos_translate_daemon.py` runs as a long-lived process. It loads the Argos model and ECDICT dictionary once at startup, then serves JSON-line requests over stdin/stdout. The extension host manages daemon lifecycle automatically.
- Fallback: `scripts/argos_translate.py` (one-shot mode, kept for backward compatibility).
- Dictionary: Single English words are detected automatically (`/^[a-zA-Z'-]+$/`) and looked up in the compact ECDICT data (`scripts/ecdict_compact.json.gz`, generated from the MIT-licensed upstream ECDICT CSV). Dictionary results include phonetics, Chinese definitions, English definitions, part-of-speech labels, and word forms when available. Non-word text falls through to neural translation.
- Current expected offline package: `en -> zh`.
- LibreTranslate remains available as an HTTP fallback through `readingExtension.libreTranslateEndpoint`.
- Argos quality is usable but limited.
- Do not commit `.venv-translate/`; it is a local runtime dependency.

## DeepSeek Translation

- Optional provider: DeepSeek's OpenAI-compatible Chat Completions endpoint.
- Default model: `deepseek-v4-flash` with thinking disabled for lower-latency translation.
- API keys must be stored through `Reading Extension: Set DeepSeek API Key`.
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

Generated `media/reader-app.js` and `media/reader-app.css` should be committed when Webview source changes, because the extension loads them at runtime.

The generated dictionary gzip (`scripts/ecdict_compact.json.gz`) should be committed so the dictionary works without an internet connection. Rebuild it with `python3 scripts/build_ecdict_compact.py`.

## Known Design Priorities

- Stability first.
- Auto-save first.
- Sync-friendly sidecar files first.
- Keep AI integration optional and cheap.
- Avoid large refactors unless they directly improve reader stability or maintainability.
- Webview state preservation: use `retainContextWhenHidden: true` and in-place `navigateTo` messaging rather than rebuilding HTML when switching PDFs.
- Translation speed: use a long-lived daemon process. Never spawn a one-shot Python process per translation request in the normal code path.
