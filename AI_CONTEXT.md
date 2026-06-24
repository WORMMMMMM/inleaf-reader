# AI Context

Last updated: 2026-06-24

## Why This Project Exists

This repository is a personal VS Code paper reader. It aims to make reading
papers and books convenient inside the editor while keeping annotations,
vocabulary, and reading progress in portable sidecar files next to each PDF.
The workflow should remain local-first, sync-friendly, stable, and usable
beside coding AI extensions without requiring a paid API.

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
- `scripts/argos_translate_daemon.py` is the normal local translation path. It
  keeps Argos Translate and the ECDICT dictionary loaded between requests.
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
- PDF loading uses `disableFontFace: true` and disables system-font fallback.
  PDF.js draws embedded glyphs with its built-in path renderer, avoiding
  Chromium/Webview failures with CID CFF fonts that can otherwise lose Chinese
  canvas text and leave scattered fallback glyphs.
- PDF.js CMap and standard-font resource URLs are injected from the extension's
  bundled `pdfjs-dist` package. This is required for CID fonts without embedded
  Unicode maps, such as the FandolSong fonts in EasyRL.
- The bundled PDF resources cover all 169 Adobe CMaps and PDF.js's complete
  Standard 14 replacement-font set. Other embedded fonts are rendered through
  PDF.js glyph paths, so the reader does not depend on network fonts.
- Trackpad zoom updates the PDF viewer immediately but defers the React zoom
  state commit until the gesture pauses. Existing highlight layers receive the
  same temporary scale transform and return to exact viewport coordinates when
  PDF.js finishes rendering the new text/page layer.
- The right reader sidebar can be hidden from either the PDF toolbar or the
  sidebar header, allowing the PDF to use the full Webview width. Translation
  selects the Translation tab without forcing a hidden sidebar open. Annotation
  editing and saving a word still reopen the relevant sidebar tab.
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
- Margin classification is cached on each PDF.js text layer, preventing
  duplicate measurements when canvas and text-layer render events both fire.
  Selection cleanup traverses only the pages between the Range start and end,
  rather than every page currently rendered in the viewer.
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

### Translation and dictionary

- DeepSeek AI translation is available through the official Chat Completions
  endpoint using `deepseek-v4-flash` by default with thinking disabled.
- The Translation sidebar switches live between local Argos/ECDICT and
  DeepSeek AI, reports whether a key exists, and opens secure key setup without
  requiring the user to edit settings manually.
- `Reading Extension: Set DeepSeek API Key` stores a newly generated key in
  VS Code SecretStorage and selects DeepSeek as the provider; the clear command
  deletes it and returns to Argos.
- Normal Argos requests use a long-lived Python daemon instead of spawning a
  one-shot process for every translation.
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

### Documentation and generated assets

- `README.md`, `AGENTS.md`, and `project_map.md` describe the daemon,
  dictionary, unified translation flow, Webview navigation, and error
  surfacing.
- Generated `media/reader-app.js` and `media/reader-app.css` are included.

## Known Risks and Items to Verify

1. Manually switch between two PDFs that already have different sidecars.
   Confirm the second PDF immediately receives its own annotations, wordbook,
   and saved page rather than showing empty or stale state.
2. Confirm that autosave messages cannot land in the wrong PDF's
   `ReaderStorage` during a rapid PDF switch.
3. Test daemon startup, shutdown, timeout, and restart behavior. The current
   request matching relies on daemon responses arriving in request order.
4. Test one known dictionary word, one missing word, and one sentence. Confirm
   missing words fall through to translation as intended.
5. Check the packaged extension contains
   `scripts/argos_translate_daemon.py` and
   `scripts/ecdict_compact.json.gz`; `.vscodeignore` currently ignores source
   directories broadly, so packaging behavior deserves explicit verification.
6. Inspect the large generated `media/reader-app.js` diff only through the
   corresponding Webview source and build output; do not edit it manually.
7. Complete the manual checks in `AGENTS.md` using a normal text PDF. Scanned
   PDFs without a text layer are not a valid selection regression test.
8. Move and rename a PDF that has been opened once by this build, leaving its
   old sidecars behind, and confirm annotations, words, and progress are copied
   to the new sidecar names. Existing destination files must remain unchanged.

## Validation Status

Update this section whenever checks are rerun.

- `npm test`: passed on 2026-06-24; this ran `npm run compile`, rebuilt
  `media/reader-app.js` and `media/reader-app.css`, and passed the annotation
  export and PDF identity regression suites.
- `./node_modules/.bin/tsc -p tsconfig.webview.json --noEmit`: passed on
  2026-06-24.
- `node --check media/reader-app.js`: passed on 2026-06-24.
- Non-blocking build warning: Vite reports that `inlineDynamicImports` is
  deprecated and recommends `codeSplitting: false`.
- Manual VS Code Extension Development Host checks: not completed yet.

## Recommended Next Steps

1. Perform the two-PDF navigation test first because it motivated the latest
   interruption.
2. Exercise dictionary lookup and sentence translation against the local
   `.venv-translate`.
3. Verify VSIX contents before considering the dictionary feature complete.
4. Address the Vite deprecation warning separately if the required config
   change is small and behavior-preserving.
5. Push the current commit only after the manual reader checks pass.

## Handoff Rule

When meaningful behavior, architecture, test status, or known risks change,
update this file together with `AGENTS.md` or `project_map.md` as appropriate.
`AGENTS.md` is for durable rules; this file is for the current development
state and unfinished work.
