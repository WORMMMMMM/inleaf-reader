# AI Context

Last updated: 2026-06-18

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
5. Fast, free local translation with optional ChatGPT prompt copying for
   higher-quality explanations.

The durable engineering rules, runtime data contract, and required checks live
in `AGENTS.md`. The file-by-file architecture map lives in `project_map.md`.

## Architecture

- `src/extension.ts` opens the reader command.
- `src/paperReaderPanel.ts` owns the VS Code Webview panel, filesystem-facing
  orchestration, clipboard access, translation process lifecycle, and messages
  between the extension host and Webview.
- `src/readerStorage.ts` persists annotations, wordbook entries, and progress
  under `.reading-extension/` next to the active PDF.
- `webview/src/main.tsx` owns the React reader UI, PDF interactions,
  annotation controls, translation display, and wordbook controls.
- `scripts/argos_translate_daemon.py` is the normal local translation path. It
  keeps Argos Translate and the ECDICT dictionary loaded between requests.
- `scripts/ecdict_compact.json.gz` is the committed offline dictionary bundle.
  The current file is about 22 MB and contains 770,611 entries.
- `media/reader-app.js` and `media/reader-app.css` are generated Webview assets
  and must be rebuilt and committed whenever the Webview source changes.

## Current Git Status

- This reader navigation and dictionary work is committed on `main`.
- Base before this work: `203cddb` (`origin/main`).
- `main` is currently one commit ahead of `origin/main`.
- `.vscode/` remains local-only and is intentionally excluded from Git.

## Work Present in the Current Commit

### Reader and persistence

- The Webview panel uses `retainContextWhenHidden: true`.
- Switching PDFs now reuses the existing Webview and sends `navigateTo`
  instead of rebuilding its HTML.
- `navigateTo` changes the active `ReaderStorage`, updates resource roots,
  sends the new PDF URL, and posts the new PDF's annotations, wordbook, and
  progress.
- The Webview resets document-specific transient state when it receives
  `navigateTo`, then accepts the following `state` payload.
- Extension-host message errors are surfaced through both a Webview
  `stateError` message and `vscode.window.showErrorMessage`.

### Translation and dictionary

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

## Validation Status

Update this section whenever checks are rerun.

- `npm test`: passed on 2026-06-18; this ran `npm run compile`, rebuilt
  `media/reader-app.js` and `media/reader-app.css`, and passed the annotation
  export regression suite.
- `./node_modules/.bin/tsc -p tsconfig.webview.json --noEmit`: passed on
  2026-06-18.
- `node --check media/reader-app.js`: passed on 2026-06-18.
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
