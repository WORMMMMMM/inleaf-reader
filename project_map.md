# Project Map

This repository contains **Inleaf Reader**, a VS Code extension for reading papers with translation assistance, annotations, vocabulary capture, and automatic local saves. Its Chinese tagline is **“进入书本，进入心流”**; internal `readingExtension.*` identifiers and `.reading-extension/` storage remain unchanged for compatibility.

## Root Files

- `README.md`: User-facing overview, setup commands, current MVP, and roadmap.
- `CONTRIBUTING.md`: Short contributor setup, fast-check, full-check, and manual-QA guide.
- `LICENSE`: MIT License for Inleaf Reader's original source code.
- `assets/reading-extension-hero.png`: README and Marketplace product screenshot showing the extension in a real VS Code reading workflow with the PDF reader, Wordbook, and adjacent AI tools.
- `assets/reading-extension-logo.png`: High-resolution transparent project logo. Its two nested open-book outlines represent entering a reading space and then settling into a focused flow state.
- `assets/reading-extension-icon.png`: 256×256 transparent Marketplace icon derived from the project logo and referenced by `package.json`.
- `assets/reading-extension-toolbar-light.svg` and `assets/reading-extension-toolbar-dark.svg`: Compact, heavier-stroke nested-book command icons for the PDF editor title toolbar, tuned separately for light and dark VS Code themes.
- `AGENTS.md`: Development handoff guide for future human or AI agents. It defines the product goal, architecture rules, important files, runtime data contract, local translation expectations, validation commands, and git hygiene.
- `package.json`: VS Code extension manifest, contributed command, configuration, scripts, and npm dependencies including the React Webview, `react-pdf-highlighter-plus`, pdf.js, and PDF export helpers.
- `package-lock.json`: Locked dependency graph for reproducible installs.
- `tsconfig.json`: TypeScript compiler settings. Source files compile from `src/` into `out/`.
- `scripts/test-annotation-exports.mjs`: Node regression test that checks annotation Markdown ordering, Markdown content, legacy/new annotation geometry export, and annotated PDF comment export after TypeScript compilation.
- `scripts/test-pdf-identity.mjs`: Regression test for sampled PDF fingerprints, rename stability, sidecar path generation, and location-index ordering.
- `scripts/test-reader-storage.mjs`: Regression test for serialized concurrent mutations, atomic JSON backups, and explicit corrupt-data errors using a local VS Code filesystem mock.
- `scripts/copy_pdfjs_assets.mjs`: Build helper that refreshes the packaged PDF.js Web Worker, CMap, and standard-font assets under `media/pdfjs-dist/`.
- `scripts/argos_translate.py`: Python helper used by the extension host for local Argos Translate calls. It reads JSON from stdin and writes a JSON translation result to stdout so the Webview never needs direct Python or network access. Kept as a fallback; the normal code path uses the daemon.
- `scripts/argos_translate_daemon.py`: Long-lived Argos sentence-translation daemon with request-id response matching. ECDICT is not loaded here.
- `scripts/build_ecdict_compact.py`: Rebuilds the compact offline dictionary from the MIT-licensed upstream ECDICT CSV, preserving Chinese translations, English definitions, phonetics, part-of-speech labels, and word-form exchange data.
- `scripts/ecdict_compact.json.gz`: Gzipped compact ECDICT dictionary (~22MB, ~770K entries). Loaded lazily by a background Node worker for single-word lookups.
- `scripts/test-ecdict-worker.mjs`: Regression test proving known/missing word lookup works without Python.
- `scripts/test-webview-worker.mjs`: Runtime-contract regression ensuring the packaged PDF.js Worker is fetched into a `blob:` URL instead of being passed directly to PDF.js as a VS Code extension-resource module URL.
- `scripts/test-inline-annotation-editor.mjs`: UI contract regression ensuring the reader starts with its side panel hidden, never opens it programmatically, and edits saved highlights through a PDF-anchored inline editor.
- `scripts/test-command-icon.mjs`: Manifest regression ensuring the PDF editor-title action uses both packaged theme-specific nested-book SVGs instead of rendering its full command title in the toolbar.
- `.gitignore`: Local files excluded from git, including `node_modules/`, compiled output, packaged extensions, and sidecar reading data.
- `.vscodeignore`: Files excluded when packaging the extension.
- `project_map.md`: This file. Keep it updated when files or responsibilities change.
- `vite.webview.config.ts`: Vite build config that bundles the React Webview into `media/reader-app.js` and `media/reader-app.css`.
- `tsconfig.webview.json`: Type-checking config for the React Webview source.

## Source

- `src/extension.ts`: Extension entrypoint. Registers `readingExtension.openReader` plus commands to set or clear the DeepSeek API key in VS Code SecretStorage, resolves the target PDF, and opens the reader panel.
- `src/paperReaderPanel.ts`: Owns the VS Code Webview panel. It wires PDF, the React bundle, CSS, and local PDF.js CMap/standard-font resource URLs into the Webview, handles messages from the reader UI, owns reliable clipboard writes for captured selections and annotation Markdown, calls local Argos Translate, LibreTranslate, or DeepSeek, and delegates persistence to `ReaderStorage`. DeepSeek uses `deepseek-v4-flash` by default with thinking disabled, and its key is read only from SecretStorage in the extension host. When switching to a different PDF, the panel sends a `navigateTo` message to the existing Webview instead of rebuilding the HTML. Local translation runs through a long-lived daemon process; single-word English inputs prefer ECDICT structured details.
- `src/ecdictClient.ts` and `src/ecdictWorker.ts`: Request-id-based background worker client and worker implementation for Python-free ECDICT lookup.
- `src/annotationTypes.ts`: Shared annotation TypeScript types used by storage, export helpers, and Webview message payloads, including optional annotation tags, selection context, legacy normalized rects, and `react-pdf-highlighter-plus` positions.
- `src/annotationExports.ts`: Pure annotation export helpers. It sorts annotations by paper position, formats full or single-annotation Markdown with tags/context, and applies visible highlight/underline marks plus native note comments to PDF bytes for both legacy rects and new highlighter positions.
- `src/readerStorage.ts`: Sidecar JSON persistence layer. It serializes mutations, distinguishes missing files from data errors, writes JSON atomically with `.bak` recovery copies, and saves progress under `.reading-extension/`. Before reading, it checks the PDF identity index and copies missing sidecars from known previous locations without overwriting current files.
- `src/pdfIdentity.ts`: Pure Node helpers for sampled PDF content fingerprints, location-index updates, and sidecar filename mapping. The index stores paths and timestamps only, never reader content.

## Webview Assets

- `webview/src/main.tsx`: React reader app. It fetches the packaged PDF.js Worker through the allowed extension-resource URL, converts the bytes to a JavaScript `blob:` URL, and gives that URL to `PdfLoader`; this keeps PDF work off the UI thread without violating the VS Code Webview module-worker sandbox. It also loads the complete Adobe CMaps and standard-font resources and uses glyph-path rendering for embedded-font compatibility. Large documents use range-oriented loading, bounded canvas image memory, and hardware acceleration where PDF.js supports it. It uses `react-pdf-highlighter-plus` for PDF rendering, text selection, zoom, scrolling, and highlight overlays. PDF.js `pagechanging` events still save the newest reading position immediately through the existing debounce, while the React page indicator is throttled during fast scrolling to avoid rebuilding the full reader tree for every traversed page. Text-layer geometry is no longer scanned after every page render; margin and figure-region classification runs lazily when selection starts and remains cached on that text layer. Trackpad pinch gestures use the same PDF.js scale state as the toolbar controls, with temporary highlight transforms only while scale rendering is active. Normal cross-page selection reconstructs text and highlight geometry without page margins or inferred figure/caption blocks; starting the drag in either non-body region deliberately preserves it. The right sidebar starts hidden and is never opened programmatically. Clicking an existing highlight opens a PDF-anchored inline editor for its style, original text, note, and tags; this also lets users correct OCR text without leaving the page. Its Translation tab switches between local Argos/ECDICT and DeepSeek AI and exposes translation readiness diagnostics. The selection toolbar has one translation flow: words show dictionary details plus `Save to Wordbook`, while sentences show translated text. Translation responses are matched to their source selection to prevent stale results.
- `webview/src/styles.css`: Reader layout, toolbar, side panel, annotation list, wordbook, dictionary result block, and responsive rules.
- `webview/src/types.ts`: Webview-side copies of persisted annotation, progress, wordbook data shapes, and `WordDetails` for dictionary results.
- `webview/src/vscodeApi.ts`: Small wrapper around `acquireVsCodeApi()` and injected reader config, including the document session id and PDF.js Worker, CMap, and standard-font resource URLs.
- `media/reader-app.js`: Generated Webview JavaScript bundle. Built by `npm run build:webview`.
- `media/reader-app.css`: Generated Webview CSS bundle. Built by `npm run build:webview`.
- `media/reader-pdf_viewer.js`: Stable-name generated PDF viewer chunk emitted by Vite and loaded dynamically by `reader-app.js`.
- `media/pdfjs-dist/`: Generated PDF.js Web Worker, CMaps, and standard fonts used at runtime, copied from the installed `pdfjs-dist` package during compilation.

## Build Output

- `out/`: Generated JavaScript and source maps from `npm run compile`. The extension entrypoint is bundled with `pdf-lib` dependencies for a compact VSIX; auxiliary modules remain available for Node regression tests. Do not edit these files manually.

## Runtime Data

For a PDF named `paper.pdf`, runtime data is written next to the PDF:

```text
.reading-extension/
  paper.pdf.annotations.json
  paper.pdf.annotations.md
  paper.pdf.annotated.pdf
  paper.pdf.wordbook.json
  paper.pdf.progress.json
```

These sidecar JSON files are intentionally plain text so they can be synchronized with Git, iCloud Drive, Dropbox, Syncthing, or another sync tool.
The previous valid JSON version is retained as an adjacent `.bak` recovery file.

The extension also keeps a lightweight content-fingerprint location index in VS Code `globalState`. If a previously opened PDF is moved or renamed, the reader can recognize the content and copy missing sidecars to the new `.reading-extension/` name. Existing files at the new location are never overwritten, and the old copies are retained as a safety backup.

## Current Architecture

```text
VS Code command
  -> src/extension.ts
  -> src/paperReaderPanel.ts
  -> Webview HTML
  -> media/reader-app.js + react-pdf-highlighter-plus
  -> user actions
  -> Webview postMessage
  -> src/paperReaderPanel.ts
  -> local Argos/LibreTranslate, DeepSeek, or src/readerStorage.ts
  -> translation result or .reading-extension/*.json
```

## Development Notes

- The reader delegates PDF canvas, text layer, selection, scrolling, and zoom behavior to `react-pdf-highlighter-plus`.
- New annotations store `react-pdf-highlighter-plus` positions plus derived normalized rectangles for export compatibility; older annotations with only normalized rectangles still load.
- Captured PDF selections can store short before/after context strings for later review.
- Text highlights can be reopened and edited directly from the PDF layer. The side list can still jump to an annotation and launch the same PDF-anchored inline editor, but it no longer contains a separate editing form.
- Individual annotations can be copied as Markdown through the extension host clipboard path.
- The annotation list summarizes the current filtered view by style, color, and top tags.
- Last deleted annotation can be restored from the status line without losing its original id or timestamps.
- Annotation tags are stored as optional string arrays and included in Markdown/PDF note exports.
- Annotation colors are stored per annotation as hex strings and styles are stored as `highlight` or `underline`; older annotations fall back to yellow highlight.
- Annotation lists can be sorted by document position, creation time, or last edit; Markdown export uses document position.
- Editing an existing annotation uses a short debounce and writes changes back automatically.
- Annotated PDF export draws visible highlight rectangles and creates native `/Text` comment annotations for note text.
- Export logic is covered by `npm test`, which verifies Markdown content, new highlighter-position compatibility, and native PDF note comments.
- Page-only notes are kept in the annotation list and exported as native PDF comments.
- Translation calls happen from the extension host instead of the Webview. Argos Translate is the default provider and runs through a long-lived daemon process for speed; LibreTranslate remains available as an HTTP fallback; optional DeepSeek translation reads its key from VS Code SecretStorage and uses the official Chat Completions endpoint.
- Single English words are detected automatically and looked up in the ECDICT dictionary (~770K entries) for phonetics, Chinese definitions, English definitions, part-of-speech labels, and word-form data. Multi-word text falls through to neural machine translation.
- The Wordbook is intentionally a simple saved-word list. Review scheduling is not part of the current product; legacy `review` fields remain readable for backward compatibility.
- `project_map.md` should be updated whenever a major file is added, removed, or changes responsibility.
