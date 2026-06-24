# Project Map

This repository is a VS Code extension prototype for reading papers with translation assistance, annotations, vocabulary capture, and automatic local saves.

## Root Files

- `README.md`: User-facing overview, setup commands, current MVP, and roadmap.
- `LICENSE`: MIT License for Reading Extension's original source code.
- `AGENTS.md`: Development handoff guide for future human or AI agents. It defines the product goal, architecture rules, important files, runtime data contract, local translation expectations, validation commands, and git hygiene.
- `package.json`: VS Code extension manifest, contributed command, configuration, scripts, and npm dependencies including the React Webview, `react-pdf-highlighter-plus`, pdf.js, and PDF export helpers.
- `package-lock.json`: Locked dependency graph for reproducible installs.
- `tsconfig.json`: TypeScript compiler settings. Source files compile from `src/` into `out/`.
- `scripts/test-annotation-exports.mjs`: Node regression test that checks annotation Markdown ordering, Markdown content, legacy/new annotation geometry export, and annotated PDF comment export after TypeScript compilation.
- `scripts/test-pdf-identity.mjs`: Regression test for sampled PDF fingerprints, rename stability, sidecar path generation, and location-index ordering.
- `scripts/copy_pdfjs_assets.mjs`: Build helper that refreshes the packaged PDF.js CMap and standard-font assets under `media/pdfjs-dist/`.
- `scripts/argos_translate.py`: Python helper used by the extension host for local Argos Translate calls. It reads JSON from stdin and writes a JSON translation result to stdout so the Webview never needs direct Python or network access. Kept as a fallback; the normal code path uses the daemon.
- `scripts/argos_translate_daemon.py`: Long-lived translation daemon. Loads the Argos Translate model and ECDICT dictionary once at startup, then serves JSON-line requests over stdin/stdout. Supports `mode: "translate"` (neural MT) and `mode: "dict"` (dictionary lookup for single words).
- `scripts/build_ecdict_compact.py`: Rebuilds the compact offline dictionary from the MIT-licensed upstream ECDICT CSV, preserving Chinese translations, English definitions, phonetics, part-of-speech labels, and word-form exchange data.
- `scripts/ecdict_compact.json.gz`: Gzipped compact ECDICT dictionary (~22MB, ~770K entries). Loaded by the daemon at startup for single-word lookups.
- `.gitignore`: Local files excluded from git, including `node_modules/`, compiled output, packaged extensions, and sidecar reading data.
- `.vscodeignore`: Files excluded when packaging the extension.
- `project_map.md`: This file. Keep it updated when files or responsibilities change.
- `vite.webview.config.ts`: Vite build config that bundles the React Webview into `media/reader-app.js` and `media/reader-app.css`.
- `tsconfig.webview.json`: Type-checking config for the React Webview source.

## Source

- `src/extension.ts`: Extension entrypoint. Registers `readingExtension.openReader` plus commands to set or clear the DeepSeek API key in VS Code SecretStorage, resolves the target PDF, and opens the reader panel.
- `src/paperReaderPanel.ts`: Owns the VS Code Webview panel. It wires PDF, the React bundle, CSS, and local PDF.js CMap/standard-font resource URLs into the Webview, handles messages from the reader UI, owns reliable clipboard writes for captured selections and annotation Markdown, calls local Argos Translate, LibreTranslate, or DeepSeek, and delegates persistence to `ReaderStorage`. DeepSeek uses `deepseek-v4-flash` by default with thinking disabled, and its key is read only from SecretStorage in the extension host. When switching to a different PDF, the panel sends a `navigateTo` message to the existing Webview instead of rebuilding the HTML. Local translation runs through a long-lived daemon process; single-word English inputs prefer ECDICT structured details.
- `src/annotationTypes.ts`: Shared annotation TypeScript types used by storage, export helpers, and Webview message payloads, including optional annotation tags, selection context, legacy normalized rects, and `react-pdf-highlighter-plus` positions.
- `src/annotationExports.ts`: Pure annotation export helpers. It sorts annotations by paper position, formats full or single-annotation Markdown with tags/context, and applies visible highlight/underline marks plus native note comments to PDF bytes for both legacy rects and new highlighter positions.
- `src/readerStorage.ts`: Sidecar JSON persistence layer. It stores, restores, and deletes colored highlight/underline annotations, calls annotation export helpers, stores and deletes vocabulary entries, and saves reading progress under `.reading-extension/` next to the PDF being read. Before reading, it checks the PDF identity index and copies missing sidecars from known previous locations without overwriting current files.
- `src/pdfIdentity.ts`: Pure Node helpers for sampled PDF content fingerprints, location-index updates, and sidecar filename mapping. The index stores paths and timestamps only, never reader content.

## Webview Assets

- `webview/src/main.tsx`: React reader app. It pre-registers PDF.js `WorkerMessageHandler` so PDF.js uses fake-worker mode in VS Code Webviews, loads the complete bundled Adobe CMap and standard-font resources, and uses glyph-path rendering for embedded-font compatibility. It uses `react-pdf-highlighter-plus` for PDF rendering, text selection, zoom, scrolling, and highlight overlays, follows PDF.js `pagechanging` events so trackpad or wheel scrolling updates the displayed page and saved reading progress, and maps trackpad pinch gestures to the same PDF.js scale state used by the toolbar controls. Pinch updates are committed to React only after the gesture pauses, while highlight layers receive a temporary matching transform and snap back to exact coordinates after PDF.js rerenders. Normal cross-page selection reconstructs text and highlight geometry without page margins or inferred figure/caption blocks; starting the drag in either non-body region deliberately preserves it. Figure blocks are inferred from `Figure` / `Fig.` captions and the preceding layout gap. Region classification is cached per completed PDF.js text layer, and cleanup traverses only pages touched by the selection Range. The right sidebar can be hidden so the PDF fills the panel; translating does not force it open, while annotation editing and word saving restore the relevant tab. Its Translation tab switches between local Argos/ECDICT and DeepSeek AI, shows whether a DeepSeek key is configured, and requests secure key setup through the extension host. It sends save/copy/delete/translation/export events back to the extension host. The selection toolbar has one translation flow: words show dictionary details plus `Save to Wordbook`, while sentences show translated text. Translation responses are matched to their source selection to prevent stale results.
- `webview/src/pdfjsWorker.d.ts`: Type declaration for importing PDF.js worker internals into the Webview bundle.
- `webview/src/styles.css`: Reader layout, toolbar, side panel, annotation list, wordbook, dictionary result block, and responsive rules.
- `webview/src/types.ts`: Webview-side copies of persisted annotation, progress, wordbook data shapes, and `WordDetails` for dictionary results.
- `webview/src/vscodeApi.ts`: Small wrapper around `acquireVsCodeApi()` and injected reader config, including PDF.js CMap and standard-font resource URLs.
- `media/reader-app.js`: Generated Webview JavaScript bundle. Built by `npm run build:webview`.
- `media/reader-app.css`: Generated Webview CSS bundle. Built by `npm run build:webview`.
- `media/pdfjs-dist/`: Generated PDF.js CMaps and standard fonts used at runtime, copied from the installed `pdfjs-dist` package during compilation.

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
- Text highlights can be reopened from the PDF layer, while all annotations can be jumped to and edited from the side list.
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
