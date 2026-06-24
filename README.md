# Reading Extension

A VS Code extension prototype for paper reading workflows: local translation, annotations, vocabulary notes, and automatic local persistence.

## Current MVP

- Open the current PDF or choose one from disk.
- Render the selected paper through a React Webview powered by `react-pdf-highlighter-plus`.
- Capture selected PDF text with the library-managed PDF.js text layer.
- Translate selected text through local Argos Translate, optional LibreTranslate, or DeepSeek V4 Flash.
- Dictionary lookup for single English words: phonetics, part-of-speech, and Chinese definitions from ECDICT (770,611 entries in the current generated bundle).
- Fast translation via a long-lived daemon process (model loads once, subsequent translations return instantly).
- Save colored highlight and underline annotations automatically to a sidecar JSON file.
- Save surrounding text context for captured PDF selections.
- Reopen text highlights from the PDF or the annotation list.
- Keep page-only notes in the saved list and annotated PDF export.
- Edit, delete, jump to, and reactivate saved annotations.
- Undo the last annotation deletion from the reader status line.
- Autosave edits to existing annotation notes, colors, styles, text, and page metadata.
- Copy a single annotation as Markdown from the annotation list.
- Add tags to annotations, then search and filter them by tag.
- See a live summary of the current annotation view by style, color, and top tags.
- Search, filter, and sort annotations by text, tag, color, style, paper order, creation time, or edit time.
- Export annotations to Markdown next to the PDF, ordered by paper position and including tags/context.
- Export a highlighted PDF copy with native note comments next to the PDF.
- Save vocabulary notes automatically to a sidecar JSON file.
- View saved vocabulary in a simple wordbook and delete entries when no longer needed.
- Restore the last-read page automatically.

## Data Model

For a paper named `paper.pdf`, the extension writes local data under:

```text
.reading-extension/
  paper.pdf.annotations.json
  paper.pdf.annotations.md
  paper.pdf.annotated.pdf
  paper.pdf.wordbook.json
  paper.pdf.progress.json
```

These files are ordinary JSON, so they can be synchronized with Git, iCloud Drive, Dropbox, Syncthing, or any other file sync tool.

## Development

```bash
npm install
npm run compile
npm test
```

Then press `F5` in VS Code to launch an Extension Development Host.

`npm run compile` builds both the React Webview bundle under `media/` and the extension host under `out/`.

`npm test` compiles the extension and runs regression checks for annotation Markdown export, annotated PDF export, and highlighter-position annotation compatibility.

See `project_map.md` for a file-by-file map of the repository.

## Local Translation

The default local provider is Argos Translate. It runs through the project-local Python virtual environment at:

```text
.venv-translate/bin/python
```

The helper script is `scripts/argos_translate.py`, and the current setup has the offline `en -> zh` package installed. The extension uses a daemon mode by default: `scripts/argos_translate_daemon.py` loads the model once and stays alive for subsequent requests, making translation nearly instant after the first call.

Single English words (e.g. "epistemology") are automatically detected and looked up in the built-in ECDICT dictionary, showing phonetics, Chinese definitions, English definitions, part-of-speech labels, and word forms when available. Multi-word sentences use neural machine translation as before.

The selection toolbar uses one `Translate` entry point: word selections show a dictionary card with `Save to Wordbook`, while sentence selections show only the translated meaning. Selecting new text clears the previous result so stale words cannot be saved accidentally.

The compact dictionary is generated from the MIT-licensed [ECDICT](https://github.com/skywind3000/ECDICT) CSV:

```bash
python3 scripts/build_ecdict_compact.py
```

This writes `scripts/ecdict_compact.json.gz`, which is loaded offline by the translation daemon. Plain `scripts/ecdict_compact.json` is only for inspection and should not be committed.

Useful VS Code settings:

```json
{
  "readingExtension.translationProvider": "argos",
  "readingExtension.argosPythonPath": "",
  "readingExtension.translationFallbackToLibreTranslate": true,
  "readingExtension.libreTranslateEndpoint": "http://localhost:5000/translate",
  "readingExtension.translationSource": "auto",
  "readingExtension.translationTarget": "zh"
}
```

If Argos fails and fallback is enabled, the extension will try the configured LibreTranslate endpoint. To use LibreTranslate as the primary provider, set:

```json
{
  "readingExtension.translationProvider": "libretranslate"
}
```

## DeepSeek AI Translation

DeepSeek translation uses `deepseek-v4-flash` by default and disables thinking
mode for lower latency. The API key is stored in VS Code SecretStorage, never
in workspace settings or repository files.

1. Revoke any key that has been pasted into chat, source code, or logs.
2. Generate a new key in the DeepSeek console.
3. Open the reader's `Translation` tab and choose `AI translation (DeepSeek V4 Flash)`.
4. Enter the new key in the secure password prompt.

The Translation tab can switch back to `Local translation (Argos + ECDICT)` at
any time. Its `Set API Key` / `Replace API Key` button opens the same secure
credential prompt as the `Reading Extension: Set DeepSeek API Key` command.
The model can be changed between `deepseek-v4-flash` and `deepseek-v4-pro` in
VS Code settings. Run `Reading Extension: Clear DeepSeek API Key` to remove the
secret and return to Argos.

Single English words still use the local ECDICT dictionary when available;
sentences and paragraphs use DeepSeek when it is selected.

## Troubleshooting

If the reader shows `Could not load PDF`, reload the Extension Development Host and run `Reading Extension: Open Paper Reader` again. The reader updates its Webview resource roots whenever the active PDF changes and pre-registers the PDF.js worker handler in the Webview bundle so PDF.js can run in fake-worker mode inside VS Code.

When switching between PDFs, the reader now sends an in-place navigation message instead of rebuilding the Webview. This preserves the Webview instance and non-document UI state while resetting the active PDF's transient selection state and loading its own sidecar data. If a filesystem error occurs (e.g. disk full), the error will surface in both the reader status bar and a VS Code notification.

If a PDF that has already been opened by this version of the extension is later moved or renamed, the reader recognizes it from a sampled content fingerprint. It copies any missing annotation, wordbook, progress, or export sidecars from a known previous location into the new PDF's `.reading-extension/` naming scheme. Current files are never overwritten, and only the fingerprint/path index—not reader content—is stored in VS Code global state.

## Roadmap

- Add a visible local translation connection check.
- Add DeepL API Free support.
- Add optional free-text notes, drawing, and shape tools from `react-pdf-highlighter-plus`.
- Improve exported PDF highlight fidelity for rotated/cropped pages.
- Improve spaced repetition scheduling and filtering.
- Add dictionary support for additional language pairs.
