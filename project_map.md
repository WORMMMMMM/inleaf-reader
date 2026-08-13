# Project Map

Use this file to locate code. Product constraints and development rules live in
`AGENTS.md`.

## Runtime Flow

```text
VS Code command
  -> src/extension.ts
  -> src/paperReaderPanel.ts
     -> src/readerStorage.ts
     -> src/translationService.ts
        -> src/ecdictClient.ts -> src/ecdictWorker.ts
        -> src/argosTranslationDaemon.ts -> scripts/argos_translate_daemon.py
        -> DeepSeek or LibreTranslate
  <-> Webview messages
  -> webview/src/main.tsx
     -> components/PdfDocumentView.tsx
     -> components/AnnotationWidgets.tsx
     -> annotationModel.ts
     -> pdfSelection.ts
```

## Extension Host

- `src/extension.ts`: Activates Inleaf Reader, registers commands, resolves the
  target PDF, manages DeepSeek credentials, and exposes translation diagnostics.
- `src/identity.ts`: Single runtime source for command, setting, secret, global
  state, Webview, fingerprint, and sidecar identifiers mirrored by the manifest.
- `src/paperReaderPanel.ts`: Coordinates the Webview lifecycle, active-document
  sessions, messages, clipboard/export actions, storage, and translation.
- `src/readerMessages.ts`: Webview-to-extension discriminated message union.
- `src/readerStorage.ts`: Reads and atomically writes annotations, wordbook, and
  progress sidecars; exports Markdown/PDF; recovers data after PDF moves.
- `src/pdfIdentity.ts`: Samples PDF content for identity fingerprints and maps
  sidecar paths for move/rename recovery.
- `src/annotationTypes.ts`: Persisted annotation schema and PDF geometry types.
- `src/annotationExports.ts`: Pure Markdown formatting and annotated-PDF export.
- `src/translationService.ts`: Translation facade and provider routing; also
  enriches wordbook entries and reports provider readiness.
- `src/translationTypes.ts`: Provider-neutral translation and dictionary types.
- `src/argosTranslationDaemon.ts`: Persistent Argos process client using a
  request-id JSON-lines protocol.
- `src/ecdictClient.ts`: Lazy worker client for offline dictionary lookup.
- `src/ecdictWorker.ts`: Background ECDICT decompression and lookup worker.

## Webview

- `webview/src/main.tsx`: React composition root and reader workflow state.
- `webview/src/components/PdfDocumentView.tsx`: Adapter for
  `react-pdf-highlighter-plus`, PDF.js events, zoom, and highlight rendering.
- `webview/src/components/AnnotationWidgets.tsx`: Annotation list/editor,
  selection toolbar, dictionary result, and wordbook presentation components.
- `webview/src/annotationModel.ts`: Pure annotation conversion, filtering,
  sorting, payload, tag, and word-summary functions.
- `webview/src/pdfSelection.ts`: Lazy margin/figure classification and clean
  cross-page PDF selection reconstruction.
- `webview/src/messages.ts`: Extension-to-Webview discriminated message union.
- `webview/src/types.ts`: Webview-side persisted and translation data types.
- `webview/src/vscodeApi.ts`: Session-aware wrapper around `acquireVsCodeApi()`
  and the reader configuration injected by the extension host.
- `webview/src/styles.css`: Reader, toolbar, panel, annotation, wordbook, and
  translation styling.

## Scripts and Bundled Data

- `scripts/argos_translate_daemon.py`: Normal long-lived Argos sentence
  translation process.
- `scripts/argos_translate.py`: One-shot compatibility fallback.
- `scripts/ecdict_compact.json.gz`: Bundled compressed offline dictionary.
- `scripts/build_ecdict_compact.py`: Rebuilds the compact dictionary.
- `scripts/copy_pdfjs_assets.mjs`: Refreshes the packaged PDF.js worker, CMaps,
  and standard fonts.
- `scripts/test-*.mjs`: Contract and regression tests for storage, exports,
  identity, dictionary lookup, Webview behavior, and manifest contributions.

## Product and Build Files

- `README.md`: Single public product introduction used by GitHub and the VS Code
  Marketplace.
- `AGENTS.md`: Product intent, architecture contracts, validation, and hygiene.
- `CONTRIBUTING.md`: Concise contributor setup and local verification workflow.
- `package.json`: Extension manifest, commands, settings, scripts, and metadata.
- `package-lock.json`: Reproducible dependency lockfile.
- `tsconfig.json`: Extension-host TypeScript configuration.
- `tsconfig.webview.json`: Webview TypeScript configuration.
- `vite.webview.config.ts`: Webview production bundle configuration.
- `assets/inleaf-reader-logo.png`: High-resolution transparent product logo.
- `assets/inleaf-reader-icon.png`: Marketplace extension icon.
- `assets/inleaf-reader-hero.png`: Public product screenshot.
- `assets/inleaf-reader-toolbar-light.svg`: Light-theme editor-title command icon.
- `assets/inleaf-reader-toolbar-dark.svg`: Dark-theme editor-title command icon.
- `LICENSE`: PolyForm Noncommercial 1.0.0 terms for version 0.0.8 and later.

## Generated Runtime Files

- `media/reader-app.js`: Generated Webview JavaScript bundle.
- `media/reader-app.css`: Generated Webview stylesheet.
- `media/reader-pdf_viewer.js`: Generated PDF viewer chunk.
- `media/pdfjs-dist/`: Generated packaged PDF.js worker, CMaps, and fonts.
- `out/extension.js`: Generated bundled extension entrypoint.
- `out/ecdictWorker.js`: Generated dictionary worker.

Edit source files, not generated runtime files. Build commands regenerate these
outputs.
