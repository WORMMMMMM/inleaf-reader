<div align="center">
  <img src="assets/reading-extension-logo.png" width="112" alt="Inleaf Reader logo">
  <h1>Inleaf Reader</h1>
  <p><strong>进入书本，进入心流</strong></p>
  <p>A local-first PDF reader for VS Code</p>
  <p>Annotate, translate, build a vocabulary list, and keep your reading data right next to your PDFs.</p>
</div>

![Inleaf Reader interface with a paper, highlights, annotations, translation, and vocabulary tools](assets/reading-extension-hero.png)

## Why I Built This

I wanted to read papers without bouncing between a separate reader and my editor. Since I'm already using AI assistants like Codex and Claude Code in VS Code, it felt natural to keep my reading workflow in the same place.

Inleaf Reader focuses on three things:

1. Annotate papers and books while you read.
2. Save unfamiliar words to a simple wordbook.
3. Read alongside the AI and development tools already in VS Code.

Optional DeepSeek translation uses your own DeepSeek API key. Local translation is also available through Argos Translate.

## Features

### PDF reading

- Open a PDF from the Command Palette, the Explorer context menu, or the PDF editor title bar.
- Continuous scrolling with synced page progress.
- Trackpad scrolling and pinch-to-zoom.
- Fit-page and fit-width controls.
- User-invoked sidebar that stays hidden until requested, for a distraction-free reading view.
- PDF-anchored inline editing for existing annotations, including manual correction of OCR text.
- Bundled PDF.js CMaps and standard fonts for better multilingual PDF support.

### Text selection

- Select PDF text for translation, copying, highlighting, or notes.
- Copy selected text with `Cmd+C` or `Ctrl+C`.
- When selecting across pages, headers, footers, page numbers, side notices, and inferred figure blocks are automatically excluded — as long as your selection starts in the body text.
- Need to include one of those? Just start the selection there.

### Annotations

- Create colored highlights and underlines.
- Attach notes and tags to selected text.
- Edit, delete, search, filter, sort, and jump to saved annotations.
- Undo the last deletion.
- Export annotations as Markdown.
- Export a highlighted PDF with native note comments.
- Everything autosaves — no save button needed.

### Translation and dictionary

- A single `Translate` action works for words, sentences, and paragraphs.
- Look up single English words offline with the bundled ECDICT dictionary.
- Shows phonetics, parts of speech, Chinese meanings, English definitions, and word forms when available.
- Translate longer text locally with Argos Translate.
- Optionally route academic text through DeepSeek.
- Use a configured LibreTranslate server as an alternative or fallback.

### Wordbook

- Save dictionary lookups to a per-PDF wordbook.
- View phonetics and structured definitions.
- Delete entries you no longer need.

### Portable local data

For a PDF named `paper.pdf`, the extension stores its data alongside the PDF:

```text
.reading-extension/
  paper.pdf.annotations.json
  paper.pdf.annotations.md
  paper.pdf.annotated.pdf
  paper.pdf.wordbook.json
  paper.pdf.progress.json
```

These are plain local files — you can sync them with Git, iCloud Drive, Dropbox, Syncthing, or any file sync tool.

JSON updates use atomic replacement and keep the previous valid version as a
`.bak` file. The backup is recovery data; the JSON file remains the active source.

The extension computes a lightweight content fingerprint so it can recover sidecar files after a PDF is moved or renamed. Existing files at the new location are never overwritten.

## Installation

### VS Code Marketplace

Once it's publicly released, search for **Inleaf Reader** in the VS Code Extensions view and hit **Install**.

### Install from a VSIX

Download the `.vsix` from the
[latest GitHub release](https://github.com/WORMMMMMM/inleaf-reader/releases/latest), then run:

```bash
code --install-extension reading-extension-0.0.7.vsix
```

Or use **Extensions: Install from VSIX...** from the Command Palette.

## Quick Start

1. Right-click a PDF in the Explorer and choose **Inleaf Reader: Open Paper Reader**.
   The same action is available as the blue nested-book icon in the PDF editor title toolbar.
2. Select text to open the floating annotation and translation toolbar.
3. Single English words use the bundled offline dictionary immediately.
4. For sentence translation, choose DeepSeek or configure Argos in the Translation panel.
5. If translation is unavailable, run **Inleaf Reader: Diagnose Translation Setup**.

The first reader launch also offers a short VS Code Getting Started walkthrough.

## Bundled Runtime Assets

If you install Inleaf Reader from the Marketplace or from the provided
VSIX, the offline dictionary and PDF font resources are already included. You
do not need to download or configure them manually.

### Offline ECDICT dictionary

The extension package contains:

```text
scripts/ecdict_compact.json.gz
```

This compressed dictionary currently contains about 770,000 English entries.
It is loaded in a background Node worker when you translate a single English
word. Dictionary lookups do not require Python, Argos, a network connection, or
an API key. The worker is started lazily so the dictionary does not slow normal
PDF startup.

### PDF.js worker, CMaps, and standard fonts

PDFs may use character maps or refer to standard fonts without embedding every
required resource. Inleaf Reader also keeps parsing and image decoding off
the reader UI thread by bundling the matching PDF.js Web Worker:

```text
media/pdfjs-dist/pdf.worker.min.mjs
media/pdfjs-dist/cmaps/
media/pdfjs-dist/standard_fonts/
```

The current package contains the complete PDF.js set of 169 Adobe CMaps and 16
standard-font resource files. The Webview fetches the packaged worker and starts
it from a `blob:` URL, as required by VS Code's Webview worker sandbox. These
resources are used automatically; no separate browser or PDF.js setup is
required. Fonts embedded inside a PDF still come from the PDF itself.

### What is not bundled

The Argos Translate Python runtime and neural translation model are not
included in the VSIX because Python environments and native dependencies are
platform-specific. Install them separately only if you want local sentence or
paragraph translation. Offline ECDICT word lookup and the bundled PDF
resources work without Argos.

## Translation Setup

### Offline dictionary

The compressed ECDICT dictionary is bundled with the extension. Single English words can be looked up without network access or any extra setup.

### Local Argos Translate

The VSIX doesn't include a Python virtual environment — those are platform- and machine-specific.

On macOS or Linux, create a virtual environment and install Argos Translate:

```bash
python3 -m venv ~/.reading-extension-argos
source ~/.reading-extension-argos/bin/activate
python -m pip install --upgrade pip
python -m pip install argostranslate
```

On Windows PowerShell:

```powershell
py -m venv $HOME\.reading-extension-argos
& $HOME\.reading-extension-argos\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install argostranslate
```

Install the English-to-Chinese model using the
[official Argos package API](https://github.com/argosopentech/argos-translate):

```bash
python - <<'PY'
import argostranslate.package

argostranslate.package.update_package_index()
packages = argostranslate.package.get_available_packages()
package = next(
    item for item in packages
    if item.from_code == "en" and item.to_code == "zh"
)
argostranslate.package.install_from_path(package.download())
print("Installed Argos en -> zh package")
PY
```

On Windows PowerShell, run the same installation code with:

```powershell
@'
import argostranslate.package

argostranslate.package.update_package_index()
packages = argostranslate.package.get_available_packages()
package = next(
    item for item in packages
    if item.from_code == "en" and item.to_code == "zh"
)
argostranslate.package.install_from_path(package.download())
print("Installed Argos en -> zh package")
'@ | python
```

Then configure the virtual environment's Python executable:

```json
{
  "readingExtension.translationProvider": "argos",
  "readingExtension.argosPythonPath": "/Users/you/.reading-extension-argos/bin/python"
}
```

On Windows, the executable normally ends with:

```text
.reading-extension-argos\Scripts\python.exe
```

Restart the reader after changing the setting. The first sentence translation starts
the local daemon and loads the model; later translations reuse that process.

### DeepSeek

1. Generate a DeepSeek API key.
2. Run **Inleaf Reader: Set DeepSeek API Key**, or select DeepSeek in the Translation sidebar.
3. Enter the key when prompted.

The key is stored with VS Code SecretStorage — it's never written to settings, sidecar files, logs, or the Webview.

Run **Inleaf Reader: Clear DeepSeek API Key** to remove it.

### LibreTranslate

Configure a LibreTranslate-compatible endpoint:

```json
{
  "readingExtension.translationProvider": "libretranslate",
  "readingExtension.libreTranslateEndpoint": "http://localhost:5000/translate"
}
```

## Settings

| Setting | Purpose |
| --- | --- |
| `readingExtension.translationProvider` | Select `argos`, `libretranslate`, or `deepseek`. |
| `readingExtension.argosPythonPath` | Python executable containing Argos Translate and language packages. |
| `readingExtension.libreTranslateEndpoint` | LibreTranslate-compatible HTTP endpoint. |
| `readingExtension.translationFallbackToLibreTranslate` | Fall back to LibreTranslate if local Argos translation fails. |
| `readingExtension.translationSource` | Translation source language code; the default is `auto`. |
| `readingExtension.translationTarget` | Translation target language code; the default is `zh`. |
| `readingExtension.deepSeekModel` | DeepSeek model requested by the configured API account. |

## Data and Privacy

- PDFs are read from paths you choose.
- Annotations, words, exports, and reading progress stay in `.reading-extension/` next to each PDF.
- A fingerprint-to-path index is stored in VS Code global state for move/rename recovery. It contains paths and timestamps, not annotation or wordbook content.
- API keys are stored in VS Code SecretStorage.
- ECDICT lookups are entirely offline.
- Local Argos translation runs on your machine.
- When DeepSeek is selected, the selected text and translation instruction are sent to the DeepSeek API.
- When LibreTranslate is selected or used as a fallback, the selected text is sent to the configured endpoint.
- The extension doesn't currently collect telemetry or analytics.

Review the privacy terms of any external translation service before using it with sensitive documents.

## Known Limitations

- Scanned PDFs without a text layer can't be selected unless you run OCR separately.
- Header, footer, and figure exclusion is heuristic — many PDFs don't provide reliable semantic structure.
- Local Argos translation requires separate Python and language-package setup.
- The current workflow is optimized for English-to-Chinese reading.
- The extension is in early preview — keep important PDFs and sidecar data backed up.

## Commands

| Command | Description |
| --- | --- |
| `Inleaf Reader: Open Paper Reader` | Open the current PDF or select one from disk. |
| `Inleaf Reader: Set DeepSeek API Key` | Store or replace the DeepSeek key securely. |
| `Inleaf Reader: Clear DeepSeek API Key` | Remove the stored DeepSeek key. |
| `Inleaf Reader: Diagnose Translation Setup` | Report dictionary, Argos, fallback, and DeepSeek readiness. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local build, test, and manual
reader-check workflow. Issues and pull requests are welcome on
[GitHub](https://github.com/WORMMMMMM/inleaf-reader).

## Acknowledgements

Inleaf Reader is built with open-source projects including:

- [PDF.js](https://mozilla.github.io/pdf.js/)
- [react-pdf-highlighter-plus](https://github.com/DanielArnould/react-pdf-highlighter-plus)
- [pdf-lib](https://pdf-lib.js.org/)
- [Argos Translate](https://www.argosopentech.com/)
- [ECDICT](https://github.com/skywind3000/ECDICT)

Third-party components and bundled assets remain subject to their respective licenses.

## License

Inleaf Reader is released under the [MIT License](LICENSE).
