# AGENTS.md

This repository contains **Inleaf Reader**, a VS Code reader with the tagline
**“Your Books. Your AI. Your Flow.”** Optimize for a calm, continuous reading
experience and practical reliability.

## Product Goal

Inleaf Reader exists to help users enter and remain in a flow state while
reading. Reading should not be interrupted by avoidable navigation, setup, or
tool switching.

- Make frequent reading actions immediate and easy to discover.
- Treat annotation, translation, and vocabulary capture as current examples of
  frequent actions, not as a closed definition of the product.
- Allow different users and reading workflows to add other frequent actions
  without forcing them into unrelated features.
- Keep reading data structured, portable, and easy for AI tools to consume.
- Let users work with the AI they already trust instead of requiring a bundled
  paid AI service.
- Help the reader ask questions, gather context, and continue reading without
  leaving the document unnecessarily.

When product choices conflict, prefer the option that reduces interruption,
preserves user control, and keeps data useful outside the extension.

## Identity Contract

- Product name: `Inleaf Reader`.
- Extension id: `ziming.inleaf-reader`.
- Package name: `inleaf-reader`.
- Command ids and walkthrough ids use `inleafReader.*`.
- Settings use the `inleafReader` namespace.
- Runtime sidecars live under `.inleaf-reader/` beside the PDF.
- Product assets use the `inleaf-reader-*` filename prefix.
- Runtime identifiers are centralized in `src/identity.ts` and mirrored by
  `package.json`; keep both surfaces consistent.

Do not introduce new identifiers based on the repository's former name. A
small, explicit compatibility path may read legacy user data during migration,
but all newly written state and all public surfaces must use the current
identity.

## Architecture and Dependency Direction

```text
src/extension.ts
  -> PaperReaderPanel
     -> HostCapabilityRegistry
        -> AnnotationHostCapability
        -> WordbookHostCapability
        -> TranslationHostCapability
     -> ReaderStorage
     -> TranslationService
        -> EcdictClient
        -> ArgosTranslationDaemon
        -> remote translation providers

webview/src/main.tsx
  -> capabilities/registry.ts
  -> capabilities/<capability>/*
  -> components/PdfDocumentView.tsx
  -> components/AnnotationWidgets.tsx
  -> annotationModel.ts
  -> pdfSelection.ts
```

- `extension.ts` registers commands and owns extension activation only.
- `PaperReaderPanel` coordinates document sessions, Webview messages,
  core progress, and capability dispatch. It must not absorb capability
  implementations, provider implementations, or domain algorithms.
- `HostCapabilityRegistry` is the extension-host composition root for reading
  capabilities. Capability messages use the standard request/event envelope;
  each capability validates and handles its own action union.
- `ReaderStorage` owns filesystem persistence and recovery.
- `TranslationService` is the single translation boundary. Provider choice,
  local dictionary enrichment, local processes, and remote APIs stay behind
  this interface.
- The Webview owns reader UI and PDF interaction; the extension host owns file
  access, clipboard access, processes, secrets, and external API calls.
- `main.tsx` coordinates reader state and workflows. PDF-library integration,
  surface state, and the capability event router. Capability panels, settings,
  local state hooks, and pure annotation/selection rules belong in focused
  modules.
- PDF rendering, text layers, scrolling, zoom, and highlight positioning stay
  delegated to `react-pdf-highlighter-plus` unless a proven limitation makes
  that impossible.

See `project_map.md` for the complete file-by-file navigation map.

## Runtime Data Contract

For `paper.pdf`, newly written data is:

```text
.inleaf-reader/
  paper.pdf.annotations.json
  paper.pdf.annotations.md
  paper.pdf.annotated.pdf
  paper.pdf.wordbook.json
  paper.pdf.progress.json
```

The three JSON files are maintained automatically. Markdown and annotated-PDF
files are optional exports and must not be described as automatic sidecars in
public documentation.

- Sidecars are intentionally plain local files that can be synchronized by
  Git or ordinary file-sync tools and inspected by external AI tools.
- Prefer explicit, stable fields and backward-compatible schema evolution.
- Do not hide user reading data in proprietary blobs or VS Code global state.
- Global state may contain only lightweight indexes needed to locate sidecars;
  never place annotations, vocabulary, notes, or reading progress there.
- JSON mutations must remain serialized and atomic. Keep `.bak` recovery copies
  of the previous valid version where the current storage layer does so.
- JSON sidecars use a versioned top-level document, are validated at runtime,
  and accept the legacy unversioned shape only through an explicit migration.
- If current JSON is invalid and a valid `.bak` exists, restore it and preserve
  the unreadable file with a `.corrupt-<timestamp>` suffix.
- Existing destination data must never be overwritten during recovery or
  migration.

## Reading Interaction Contract

- Frequent actions should be available at the point of reading with minimal
  steps and without unnecessary panel changes.
- The right-side panel is user-invoked and hidden on startup. Annotation edits,
  translation, and word saving must not open it automatically.
- The top toolbar exposes adjacent `Show panel` and `Settings` controls. The
  right-side surface has three states: closed, reading workspace, and settings.
  Settings is not a workspace tab and closing it restores the prior workspace
  when appropriate.
- Keep configuration exclusively in Settings. Workspace panels and Overview
  show document content, reading state, and capability results without
  repeating provider or setup fields.
- Clicking a saved highlight opens inline `Edit` and `Delete` actions near the
  PDF content. `Edit` then opens the inline annotation editor.
- The original selected text remains editable so OCR mistakes can be corrected.
- Selection uses one `Translate` action: single English words may show
  dictionary details and `Save to Wordbook`; longer text shows translation.
- New reading actions should be designed as composable capabilities rather
  than hard-coded exceptions in the top-level UI.
- Extension-host handler errors must reach both the Webview through
  `stateError` and the user through `vscode.window.showErrorMessage`.

## Capability Contract

- `src/capabilities/contracts.ts` is the manifest and preference contract.
  Stable capability ids currently include `annotations`, `wordbook`, and
  `translation`.
- A capability may contribute inline actions, a workspace panel, settings, and
  persisted data. `enabled` and `showInPanel` are independent; hiding or
  disabling a capability never deletes its sidecars.
- Webview requests use `capabilityRequest`; host responses use
  `capabilityEvent`. Keep core document navigation and reading progress outside
  capability protocols.
- Add host behavior through `HostCapabilityRegistry` and Webview presentation
  through `webview/src/capabilities/registry.ts`. Do not add feature switches
  back to `PaperReaderPanel`.
- Each capability owns a runtime decoder for its actions. Never trust an
  `unknown` payload or allow protected persisted fields to cross a mutation
  boundary unchecked.
- Capability host implementations depend on narrow storage interfaces. The
  shared `ReaderStorage` engine continues to provide serialized atomic writes,
  backups, recovery, and migration.
- Ordinary settings are edited in the in-reader Settings surface and persisted
  through VS Code configuration. Secrets stay in Extension Host SecretStorage;
  the Webview receives readiness booleans only.
- Serialize capability preference writes and read the current value inside the
  queue. Configuration/secret events are the refresh entry point: publish only
  affected settings and descriptors, never reload every capability's data.
- Validate wordbook mutations with the same field rules as persisted word
  records; discard client-supplied ids and timestamps before writing.

## Translation Contract

- Translation is one capability with interchangeable providers, not separate
  product modules for local and hosted translation.
- Single English words prefer the bundled ECDICT worker so dictionary details
  and wordbook capture remain fast, offline, and independent of Python.
- ECDICT is stored as compressed hash shards. Load only the shard required for
  a lookup and keep the worker cache bounded; never parse the entire dictionary
  into memory.
- Sentence translation defaults to the long-lived Argos daemon when available;
  do not spawn a new Python process for every normal request.
- LibreTranslate and DeepSeek are optional providers behind
  `TranslationService`.
- Remote translation is opt-in. Never require a paid API for the core reading
  and annotation experience.
- API keys must be accepted through password inputs and stored only in VS Code
  SecretStorage. Never expose them to the Webview, settings JSON, sidecars,
  logs, or source files.
- Translation responses remain tied to both the source text and active document
  session so stale asynchronous results cannot replace newer work.
- Carry a unique translation request id through each request and result. Only
  the active request may update the UI, even when two requests have identical
  source text. Cancel obsolete remote requests; skip cancelled queued Argos
  requests without killing an active local computation.

## Code Quality Principles

- Prefer cohesive modules organized around reasons to change, not arbitrary
  file-size limits.
- Keep orchestration thin and domain transformations pure where practical.
- Use discriminated unions for cross-boundary messages and explicit types for
  persisted or provider-facing data.
- Depend on stable interfaces rather than reaching into another module's
  internal state.
- Avoid duplicated business rules, hidden mutation, broad `any` types, and
  comments that merely restate code.
- Do not fragment straightforward logic into many tiny files. Extract a module
  when it creates a meaningful boundary, independent testability, or reuse.
- Preserve user behavior and persisted data during refactors unless the product
  change explicitly requires a migration.
- Generated files under `media/` and `out/` are outputs, not source. Never edit
  them manually.

## Performance Constraints

- Keep PDF parsing and image decoding in the packaged PDF.js Web Worker; never
  restore an in-bundle fake worker.
- VS Code Webviews cannot reliably start the packaged module worker directly
  from an extension-resource URL. Fetch it, wrap it in a JavaScript `Blob`, and
  give the `blob:` URL to `PdfLoader`.
- Do not perform synchronous text-layer geometry scans in page-render or scroll
  handlers. Selection-region analysis stays lazy and cached per text layer.
- Preserve Webview state with `retainContextWhenHidden: true` and switch PDFs
  through in-place `navigateTo` messages.
- Avoid React state updates for every event in rapid scroll or zoom bursts when
  a throttled visual update and debounced persistence are sufficient.
- Batch rendered page numbers during zoom into one animation-frame update;
  events from different pages must not cancel each other's highlight cleanup.

## AI Reading Order

For most tasks:

1. Read this file for product and engineering constraints.
2. Use `project_map.md` to locate the relevant boundary.
3. For capability work, read the shared contract and that capability's host,
   protocol, storage adapter, Webview hook, and panel. Read unrelated
   capabilities only when a declared dependency requires it.
4. Inspect the matching regression test before changing behavior.
5. Run the smallest relevant checks during development, then `npm test` before
   handing off the result.

Treat source code and tests as the current implementation truth. Do not create
another broad status document that duplicates this file or `project_map.md`.

## Validation Requirements

Fast inner-loop checks:

```bash
npm run test:unit
npm run typecheck
```

Required before committing code changes:

```bash
npm test
```

`npm test` rebuilds the Webview and extension, runs regression tests, checks
both TypeScript projects, and validates generated JavaScript syntax. When
source changes affect the installed extension, ensure the corresponding
generated runtime assets are included.

Before a release, also package a VSIX, run an archive-integrity check, and
confirm that only one public README is included.

## Manual QA

Use at least one normal text PDF:

- Open the PDF and confirm the Webview is not blank.
- Scroll rapidly and verify the reader remains responsive.
- Switch quickly between two PDFs and confirm their progress and sidecars do
  not cross document sessions.
- Select text across pages and verify normal body selection excludes cached
  margins and inferred figure blocks.
- Create, edit, delete, and undo annotations without forcing the side panel open.
- Open Settings from the toolbar, change capability visibility/order, and
  confirm closing Settings restores the previous workspace state.
- Disable and re-enable each capability; confirm its inline actions and panel
  contribution follow the preference while existing sidecar data remains.
- Close and reopen the reader and confirm annotations, wordbook entries, and
  progress return.
- Check a known dictionary word, a missing word, and a sentence translation.
- If a remote provider is configured, confirm it works without exposing its
  credential to the Webview.

Scanned PDFs without a text layer are not expected to support selection unless
OCR is added explicitly.

## Git and Release Hygiene

Do not commit:

- `.vscode/`
- `.venv-translate/`
- `node_modules/`
- `out/`
- user PDFs
- runtime `.inleaf-reader/` data
- packaged `*.vsix` files
- uncompressed generated dictionary sources

Commit generated Webview assets under `media/` when their source changes,
because the installed extension loads them at runtime. Commit the compressed
ECDICT shards required for offline dictionary lookup. Keep
`THIRD_PARTY_NOTICES.md` and asset-specific license files with redistributed
dependencies and data.
