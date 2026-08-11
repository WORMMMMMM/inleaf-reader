# AI Context

Last updated: 2026-08-08

## Why This Project Exists

This repository is a personal VS Code paper reader. It aims to make reading
papers and books convenient inside the editor while keeping annotations,
vocabulary, and reading progress in portable sidecar files next to each PDF.
The workflow should remain local-first, sync-friendly, stable, and usable
beside coding AI extensions without requiring a paid API.

The public product name is **Inleaf Reader** and its Chinese tagline is
**“进入书本，进入心流”**. For upgrade and data compatibility, the internal
extension id remains `ziming.reading-extension`, command and setting ids remain
under `readingExtension.*`, and sidecars remain under `.reading-extension/`.
The GitHub repository is `WORMMMMMM/inleaf-reader`; the local directory name may
remain `reading-extension`.

## Product Priorities

1. Reliability and automatic persistence.
2. A real paper-reading workflow rather than a thin PDF demo.
3. Sidecar data that can sync through Git or ordinary file-sync tools.
4. PDF rendering and text interaction delegated to
   `react-pdf-highlighter-plus`.
5. Fast, free local translation and structured offline dictionary results.

The durable engineering rules, runtime data contract, and required checks live
in `AGENTS.md`. The file-by-file architecture map lives in `project_map.md`.

## Architecture

- `src/extension.ts` opens the reader command.
- `src/paperReaderPanel.ts` owns the VS Code Webview panel, filesystem-facing
  orchestration, clipboard access, translation process lifecycle, optional
  DeepSeek API calls, and messages between the extension host and Webview.
- DeepSeek credentials are stored only through VS Code SecretStorage commands
  registered in `src/extension.ts`; they are never injected into the Webview.
- `src/readerStorage.ts` persists annotations, wordbook entries, and progress
  under `.reading-extension/` next to the active PDF. It also recovers missing
  sidecars after a known PDF is moved or renamed.
- `src/pdfIdentity.ts` computes a sampled content fingerprint and maintains a
  lightweight path index in VS Code global state. No annotation, wordbook, or
  progress content is stored in that index.
- `webview/src/main.tsx` owns the React reader UI, PDF interactions,
  annotation controls, translation display, and wordbook controls.
- `scripts/argos_translate_daemon.py` is the normal local sentence-translation
  path. It keeps Argos loaded and matches responses with request ids.
- `src/ecdictClient.ts` and `src/ecdictWorker.ts` provide lazy, Python-free
  offline dictionary lookup outside the extension-host main thread.
- `scripts/ecdict_compact.json.gz` is the committed offline dictionary bundle.
  The current file is about 22 MB and contains 770,611 entries.
- `media/reader-app.js` and `media/reader-app.css` are generated Webview assets
  and must be rebuilt and committed whenever the Webview source changes.

## Current Git Status

- Development continues on `main`, which contains local unpushed commits.
- The current reader stability, persistence recovery, simplified Wordbook,
  collapsible sidebar, font compatibility, and selection-cleanup changes are
  intended to be committed together as one completed feature batch.
- `.vscode/` remains local-only and is intentionally excluded from Git.

## Current Development State

### Reader and persistence

- The PDF editor-title action uses the theme-specific custom nested-book SVGs
  under `assets/`. VS Code renders only the compact brand icon in the editor
  toolbar while retaining `Inleaf Reader: Open Paper Reader` as the tooltip
  and Command Palette title.
- The Webview panel uses `retainContextWhenHidden: true`.
- The page indicator and saved reading progress follow PDF.js `pagechanging`
  events, including continuous scrolling with a mouse wheel or trackpad.
- Trackpad pinch gestures zoom the PDF through the viewer's wheel events while
  ordinary two-finger scrolling remains unchanged. Toolbar zoom controls use
  the same PDF.js scale state.
- Switching PDFs now reuses the existing Webview and sends `navigateTo`
  instead of rebuilding its HTML.
- Each PDF URL gets a fresh `PdfLoader` instance. Expected PDF.js worker
  termination during a document switch is ignored by runtime error boundaries
  instead of being shown as a reader startup failure.
- PDF.js now loads `media/pdfjs-dist/pdf.worker.min.mjs` as a real Web Worker.
  The Webview first fetches the extension resource, wraps its bytes in a
  JavaScript `Blob`, and passes the resulting `blob:` URL to `PdfLoader`.
  Direct module-worker loading from the VS Code extension-resource URL failed
  in an installed VSIX. Parsing and image decoding remain off the Webview UI
  thread; do not restore either that direct URL or the previous in-bundle
  `WorkerMessageHandler` fake-worker setup.
- Large documents disable eager auto-fetching, request 1 MiB ranges, cap a
  single canvas image allocation at 64 MiB, and enable PDF.js hardware
  acceleration when the Webview supports it. This specifically targets
  image-heavy books such as the 172 MB, 189-page EasyRL PDF.
- PDF loading uses `disableFontFace: true` and disables system-font fallback.
  PDF.js draws embedded glyphs with its built-in path renderer, avoiding
  Chromium/Webview failures with CID CFF fonts that can otherwise lose Chinese
  canvas text and leave scattered fallback glyphs.
- PDF.js CMap and standard-font resource URLs are injected from the extension's
  generated `media/pdfjs-dist` runtime assets. This is required for CID fonts
  without embedded Unicode maps, such as the FandolSong fonts in EasyRL.
- The bundled PDF resources cover all 169 Adobe CMaps and PDF.js's complete
  Standard 14 replacement-font set. Other embedded fonts are rendered through
  PDF.js glyph paths, so the reader does not depend on network fonts.
- Trackpad zoom updates the PDF viewer immediately but defers the React zoom
  state commit until the gesture pauses. Existing highlight layers receive the
  same temporary scale transform and return to exact viewport coordinates when
  PDF.js finishes rendering the new text/page layer.
- The right reader sidebar starts hidden and can be shown only from the PDF
  toolbar. Translation, annotation editing, and word saving can update the
  relevant background tab state but never make the panel visible.
- Clicking an existing PDF highlight opens a tip-positioned inline editor next
  to the highlight. It edits color, highlight/underline style, original text,
  note, and tags, then saves through the normal `updateAnnotation` message.
  Making original text editable provides a manual correction path for poor OCR.
  The Annotations side list launches the same inline editor instead of owning a
  separate editing form.
- The sidebar toggle is placed before the flexible status text and cannot
  shrink, preventing VS Code's right-side UI from clipping the Show panel
  button.
- Text in the top/bottom 8% and left/right 4% of each rendered PDF page is
  excluded from normal selection. CSS provides immediate browser behavior,
  while selection capture also reconstructs text from allowed PDF text nodes
  and removes page-margin rectangles from the ghost highlight. This prevents
  headers, footers, side copyright notices, and page numbers from contaminating
  cross-page copy/translate/highlight selections. Starting a drag directly on
  margin text preserves the complete selection so those elements remain
  deliberately selectable.
- Margin and figure classification runs lazily on pointer-down instead of from
  PDF.js page/text-layer render events, then remains cached on that completed
  text layer. This keeps repeated `getBoundingClientRect()` passes out of the
  fast-scroll path. Selection cleanup traverses only the pages between the
  Range start and end, rather than every page currently rendered in the viewer.
- Fast `pagechanging` bursts still feed the debounced progress save, but update
  the React page indicator at most once every 80 ms. Highlight-layer transform
  synchronization also exits immediately unless a zoom render is active.
- Completed text layers are also scanned for `Figure` / `Fig.` caption lines.
  A significant vertical gap before a caption defines the associated figure
  block; its text and caption are excluded when selection starts in body text.
  Starting the drag inside that inferred figure block preserves it.
- Creating the temporary ghost highlight clears the browser's native Selection,
  so captured PDF text is copied through the extension host clipboard path.
  Cmd/Ctrl+C copies the captured text; focused inputs and textareas retain
  their normal copy behavior. The floating selection toolbar intentionally has
  no separate Copy button.
- `navigateTo` changes the active `ReaderStorage`, updates resource roots,
  sends the new PDF URL, and posts the new PDF's annotations, wordbook, and
  progress.
- On storage preparation, the extension fingerprints the PDF from its size and
  up to three 1 MiB samples. It checks prior locations for the same fingerprint
  and copies only sidecars missing at the new location. Existing destination
  data is never overwritten and old copies are retained.
- Recovery also checks for the old sidecar basename inside the new
  `.reading-extension/` directory, covering a folder move combined with a PDF
  rename when the sidecar folder moved with it.
- The Webview resets document-specific transient state when it receives
  `navigateTo`, then accepts the following `state` payload.
- Extension-host message errors are surfaced through both a Webview
  `stateError` message and `vscode.window.showErrorMessage`.
- Every Webview request carries a document-session id. Stale requests are
  rejected, except a debounced progress flush can still be routed to the
  immediately previous PDF's captured `ReaderStorage`.
- Annotation and word mutations are serialized per storage instance. JSON is
  written by temp-file rename, retains a `.bak` previous version, and no longer
  treats parse or permission errors as empty state.
- Mutation responses use `statePatch`, avoiding the former reread of all three
  JSON sidecars after every annotation or word change.

### Translation and dictionary

- DeepSeek AI translation is available through the official Chat Completions
  endpoint using `deepseek-v4-flash` by default with thinking disabled.
- The Translation sidebar switches live between local Argos/ECDICT and
  DeepSeek AI, reports whether a key exists, and opens secure key setup without
  requiring the user to edit settings manually.
- `Inleaf Reader: Set DeepSeek API Key` stores a newly generated key in
  VS Code SecretStorage and selects DeepSeek as the provider; the clear command
  deletes it and returns to Argos.
- Normal Argos sentence requests use a long-lived Python daemon instead of
  spawning a one-shot process for every translation.
- ECDICT lookup no longer starts Python or imports Argos.
- A single English word is routed to ECDICT lookup; multi-word text is routed
  to Argos neural translation.
- Dictionary results can include phonetics, Chinese translations, English
  definitions, part-of-speech labels, and word forms.
- The selection UI has one translation entry point. Dictionary results expose
  `Save to Wordbook`; sentence translations do not.
- Wordbook records now support optional `phonetic` and structured
  `definitions` fields while retaining compatibility with older records.
- The Wordbook is a simple saved-word list with per-entry deletion. The former
  due/review scheduling UI and storage updates have been removed; legacy
  `review` fields in existing JSON remain harmless and readable.
- Translation results include their source text so stale async results are not
  shown for a newer selection.
- `scripts/build_ecdict_compact.py` rebuilds the committed gzip from upstream
  MIT-licensed ECDICT data.
- The Translation tab reports dictionary and Argos-Python readiness and can
  launch `Inleaf Reader: Diagnose Translation Setup`.

### Documentation and generated assets

- `README.md`, `AGENTS.md`, and `project_map.md` describe the daemon,
  dictionary, unified translation flow, Webview navigation, and error
  surfacing.
- `README.md` is shared by GitHub and the VS Code Marketplace. It now includes
  product motivation, features, installation, quick start, translation setup,
  settings, privacy disclosures, limitations, and a short contribution link.
  `README2.md` remains the user's editable working draft. The public README
  intentionally omits internal development/build instructions; those remain
  in `AGENTS.md`, `AI_CONTEXT.md`, and `project_map.md`.
- The README explicitly distinguishes bundled runtime assets from optional
  dependencies: ECDICT, 169 PDF.js CMaps, and 16 standard-font files require no
  user installation; source builds refresh them through `npm run compile`.
  Argos Python and its `en -> zh` model have separate macOS/Linux and Windows
  installation instructions.
- `assets/reading-extension-hero.png` is the public README product screenshot,
  showing the reader, Wordbook sidebar, PDF content, and adjacent AI tooling in
  a real VS Code-style workflow.
- The README header uses a compact centered stack: 112px logo, product name,
  the Chinese tagline “进入书本，进入心流”, a short category line, and a
  one-sentence value proposition above the screenshot.
- `assets/reading-extension-logo.png` is the high-resolution transparent
  project logo. Its two nested open-book outlines express moving from a reading
  space into a focused flow state. Its heavier strokes preserve the mark at
  small sizes. `assets/reading-extension-icon.png` is its 256px Marketplace
  variant and is wired through the extension manifest's `icon` field. The
  matching light/dark toolbar SVGs are wired through the Open Reader command.
- The repository is licensed under MIT through the root `LICENSE`; third-party
  components and bundled assets retain their respective licenses.
- Generated `media/reader-app.js` and `media/reader-app.css` are included.
- `media/reader-pdf_viewer.js` is a stable-name generated chunk used by the
  Webview; Vite `codeSplitting: false` replaces the deprecated
  `inlineDynamicImports` setting.
- `npm run compile` also refreshes the PDF.js Worker, CMaps, and standard fonts
  under `media/pdfjs-dist` and bundles the extension host into
  `out/extension.js`, allowing VSIX packaging without shipping the full
  `node_modules` tree.

## Known Risks and Items to Verify

1. Manually switch between two PDFs that already have different sidecars.
   Confirm the second PDF immediately receives its own annotations, wordbook,
   and saved page rather than showing empty or stale state.
2. Confirm that document-session ids reject stale autosave messages during a
   rapid PDF switch and that the pending old-page progress flush reaches only
   the old PDF.
3. Test daemon startup, shutdown, timeout, and restart behavior. Responses now
   carry request ids, including after one request times out.
4. Manually test one known dictionary word, one missing word, and one sentence.
   The known/missing worker paths have automated coverage.
5. Inspect the large generated `media/reader-app.js` diff only through the
   corresponding Webview source and build output; do not edit it manually.
6. Complete the manual checks in `AGENTS.md` using a normal text PDF. Scanned
   PDFs without a text layer are not a valid selection regression test.
7. Move and rename a PDF that has been opened once by this build, leaving its
   old sidecars behind, and confirm annotations, words, and progress are copied
   to the new sidecar names. Existing destination files must remain unchanged.
8. Open `EasyRL_v1.0.6.pdf`, rapidly scrub through image-heavy pages, and
   compare scrolling with the previous fake-worker build. Also verify that
   beginning a text selection still excludes cached margins and figure blocks.

## Validation Status

Update this section whenever checks are rerun.

- `npm test`: passed on 2026-08-08 for version 0.0.7 after the Inleaf Reader
  rebrand. It rebuilt generated assets and passed
  annotation export, PDF identity, serialized/atomic storage, and Python-free
  ECDICT worker regressions, passed the Webview Worker loading and inline
  annotation editor contracts, verified the editor-title command icon,
  type-checked extension and Webview code, and syntax-checked the generated
  Webview entry.
- Argos daemon smoke test: passed on 2026-07-11 against the local `en -> zh`
  model; request id `7` was echoed with a sentence translation.
- VSIX packaging: passed on 2026-08-08 for version 0.0.7 with 204 files and a
  25.67 MB package.
  Verified `out/extension.js`, `out/ecdictWorker.js`, the stable PDF viewer
  chunk, the 1.31 MB real PDF.js Worker, 169 CMaps, 16 fonts, translation
  scripts, and ECDICT; auxiliary build modules, `node_modules`, and
  `.venv-translate` are excluded.
- Moving PDF.js out of the main Webview bundle reduced `reader-app.js` from
  about 4.19 MB to 2.60 MB uncompressed (about 38%).
- Isolated VS Code CLI installation: `ziming.reading-extension@0.0.7`
  successfully installed while displaying `Inleaf Reader`. The packaged and
  installed command titles, configuration title, Chinese tagline, toolbar
  SVGs, and compatibility-preserving internal extension id were verified.
- The prior Vite `inlineDynamicImports` deprecation warning is resolved.
- Manual VS Code Extension Development Host checks: not completed yet.

## Recommended Next Steps

1. Perform the two-PDF navigation and rapid-switch checks in an Extension
   Development Host using PDFs with different sidecars.
2. Complete the remaining manual reader UI checklist in `AGENTS.md`.
3. Push only after those visual/manual checks pass.

## Handoff Rule

When meaningful behavior, architecture, test status, or known risks change,
update this file together with `AGENTS.md` or `project_map.md` as appropriate.
`AGENTS.md` is for durable rules; this file is for the current development
state and unfinished work.
