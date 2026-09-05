# Project Map

Use this file to locate code. Product constraints and development rules live in
`AGENTS.md`.

## Runtime Flow

```text
VS Code command
  -> src/extension.ts
  -> src/paperReaderPanel.ts
     -> src/capabilities/hostRegistry.ts
        -> annotations/host.ts -> annotations/storage.ts
        -> wordbook/host.ts -> wordbook/storage.ts
        -> translation/host.ts -> src/translationService.ts
     -> src/readerStorage.ts
     -> src/translationService.ts
        -> src/ecdictClient.ts -> src/ecdictWorker.ts
        -> src/argosTranslationDaemon.ts -> scripts/argos_translate_daemon.py
        -> DeepSeek or LibreTranslate
  <-> Webview messages
  -> webview/src/main.tsx
     -> capabilities/registry.ts
     -> capabilities/SettingsView.tsx
     -> capabilities/<capability>/*
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
  sessions, core progress/clipboard messages, and capability dispatch.
- `src/readerMessages.ts`: Small core message union plus the shared capability
  request envelope.
- `src/capabilities/contracts.ts`: Capability manifests, preferences,
  readiness, ordering, and the reader-surface states.
- `src/capabilities/protocol.ts`: Standard capability request/event envelopes.
- `src/capabilities/preferences.ts`: Persists capability enablement, panel
  visibility, and ordering through VS Code configuration.
- `src/capabilities/hostRegistry.ts`: Registers host implementations and keeps
  feature switches out of `PaperReaderPanel`.
- `src/capabilities/*/host.ts`: Feature-specific request handling and state
  publication.
- `src/capabilities/*/protocol.ts`: Feature-specific action/event unions and
  runtime request validation.
- `src/capabilities/annotations/storage.ts` and
  `src/capabilities/wordbook/storage.ts`: Narrow storage interfaces over the
  shared atomic `ReaderStorage` engine.
- `src/readerStorage.ts`: Reads and atomically writes annotations, wordbook, and
  progress sidecars; exports Markdown/PDF; recovers invalid data and data after
  PDF moves.
- `src/sidecarSchemas.ts`: Versioned sidecar decoding, runtime validation, and
  legacy-format migration.
- `src/pdfIdentity.ts`: Samples PDF content for identity fingerprints and maps
  sidecar paths for move/rename recovery.
- `src/annotationTypes.ts`: Persisted annotation schema and PDF geometry types.
- `src/readerDataTypes.ts`: Provider-neutral wordbook and progress records used
  across storage, translation, and message boundaries.
- `src/annotationExports.ts`: Pure Markdown formatting and annotated-PDF export.
- `src/translationService.ts`: Translation facade and provider routing; also
  enriches wordbook entries and reports provider readiness.
- `src/translationTypes.ts`: Provider-neutral translation and dictionary types.
- `src/translationContract.ts`: Shared provider/model identifiers and strict
  runtime configuration validation used by both host and Webview.
- `src/argosTranslationDaemon.ts`: Persistent Argos process client using a
  request-id JSON-lines protocol.
- `src/ecdictClient.ts`: Lazy worker client for offline dictionary lookup.
- `src/ecdictWorker.ts`: Background ECDICT shard loading, bounded caching, and
  lookup worker.

## Webview

- `webview/src/main.tsx`: React composition root, PDF workflow, three-state
  right-side surface, and capability event routing.
- `webview/src/capabilities/registry.ts`: The Webview composition root for
  capability panels; orders visible contributions and routes capability events
  to feature hooks.
- `webview/src/capabilities/ReaderSideSurface.tsx`: Generic closed/workspace/
  settings surface and workspace-tab shell.
- `webview/src/capabilities/SettingsView.tsx`: In-reader settings for capability
  enablement, panel composition, order, and translation configuration.
- `webview/src/capabilities/annotations/`: Annotation panel and feature-local
  Webview state.
- `webview/src/capabilities/wordbook/`: Wordbook panel and feature-local
  Webview state.
- `webview/src/capabilities/translation/`: Translation result panel and
  feature-local settings/result state.
- `webview/src/capabilities/OverviewPanel.tsx`: Core document metrics and live
  reading status without duplicating configuration from Settings; it is
  not a capability and remains available even when all capabilities are hidden.
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
- `scripts/ecdict/`: Bundled compressed offline dictionary manifest and shards.
- `scripts/build_ecdict_compact.py`: Rebuilds the sharded dictionary.
- `scripts/copy_pdfjs_assets.mjs`: Refreshes the packaged PDF.js worker, CMaps,
  and standard fonts.
- `scripts/test-*.mjs`: Contract and regression tests for storage, exports,
  identity, dictionary lookup, Webview behavior, and manifest contributions.
- `scripts/test-reader-concurrency.mjs`: Behavior checks with controlled I/O,
  frame scheduling, and request completion order for settings, zoom, wordbook
  validation, translation cancellation, and selective configuration refresh.

## Product and Build Files

- `README.md`: Single public product introduction used by GitHub and the VS Code
  Marketplace.
- `AGENTS.md`: Product intent, architecture contracts, validation, and hygiene.
- `CONTRIBUTING.md`: Concise contributor setup and local verification workflow.
- `package.json`: Extension manifest, commands, settings, scripts, and metadata.
- `package-lock.json`: Reproducible dependency lockfile.
- `tsconfig.json`: Extension-host TypeScript configuration.
- `tsconfig.webview.json`: Webview TypeScript configuration.
- `vite.webview.config.mts`: Webview production bundle configuration.
- `assets/inleaf-reader-logo.png`: High-resolution transparent product logo.
- `assets/inleaf-reader-icon.png`: Marketplace extension icon.
- `assets/inleaf-reader-example.png`: Public product screenshot.
- `assets/inleaf-reader-toolbar-light.svg`: Light-theme editor-title command icon.
- `assets/inleaf-reader-toolbar-dark.svg`: Dark-theme editor-title command icon.
- `LICENSE`: Apache License 2.0 terms for the project.
- `NOTICE`: Project copyright and attribution notice distributed with releases.
- `THIRD_PARTY_NOTICES.md`: Licenses and attribution for bundled dependencies
  and dictionary data.

## Generated Runtime Files

- `media/reader-app.js`: Generated Webview JavaScript bundle.
- `media/reader-app.css`: Generated Webview stylesheet.
- `media/reader-pdf_viewer.js`: Generated PDF viewer chunk.
- `media/pdfjs-dist/`: Generated packaged PDF.js worker, CMaps, and fonts.
- `out/extension.js`: Generated bundled extension entrypoint.
- `out/ecdictWorker.js`: Generated dictionary worker.

Edit source files, not generated runtime files. Build commands regenerate these
outputs.
