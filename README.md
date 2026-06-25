<p align="center">
  <img src="assets/reading-extension-logo.png" width="160" alt="Reading Extension logo">
</p>

# Reading Extension

A local-first PDF reader for VS Code — annotate, translate, build a vocabulary list, and keep your reading data right next to your PDFs.

![Reading Extension interface with a paper, highlights, annotations, translation, and vocabulary tools](assets/reading-extension-hero.png)

## Why I Built This

I wanted to read papers without bouncing between a separate reader and my editor. Since I'm already using AI assistants like Codex and Claude Code in VS Code, it felt natural to keep my reading workflow in the same place.

Reading Extension focuses on three things:

1. Annotate papers and books while you read.
2. Save unfamiliar words to a simple wordbook.
3. Read alongside the AI and development tools already in VS Code.

Optional DeepSeek translation uses your own DeepSeek API key. Local translation is also available through Argos Translate.

## Features

### PDF reading

- Open a PDF from the Command Palette, or open the reader while a PDF is already active.
- Continuous scrolling with synced page progress.
- Trackpad scrolling and pinch-to-zoom.
- Fit-page and fit-width controls.
- Collapsible sidebar for a distraction-free reading view.
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

The extension computes a lightweight content fingerprint so it can recover sidecar files after a PDF is moved or renamed. Existing files at the new location are never overwritten.

## Installation

### VS Code Marketplace

Once it's publicly released, search for **Reading Extension** in the VS Code Extensions view and hit **Install**.

### Install from a VSIX

Download the latest `.vsix`, then run:

```bash
code --install-extension reading-extension-0.0.1.vsix
```

Or use **Extensions: Install from VSIX...** from the Command Palette.

### Build from source

```bash
git clone https://github.com/WORMMMMMM/reading-extension.git
cd reading-extension
npm install
npm test
npx @vscode/vsce package \
  --no-dependencies \
  --allow-missing-repository \
  --out reading-extension-0.0.1.vsix
code --install-extension ./reading-extension-0.0.1.vsix --force
```

## Bundled Runtime Assets

If you install Reading Extension from the Marketplace or from the provided
VSIX, the offline dictionary and PDF font resources are already included. You
do not need to download or configure them manually.

### Offline ECDICT dictionary

The extension package contains:

```text
scripts/ecdict_compact.json.gz
```

This compressed dictionary currently contains about 770,000 English entries.
It is loaded locally when you translate a single English word. Dictionary
lookups do not require Python, a network connection, or an API key.

To verify a source checkout:

```bash
test -f scripts/ecdict_compact.json.gz
```

Maintainers can rebuild the dictionary from the upstream MIT-licensed ECDICT
CSV:

```bash
python3 scripts/build_ecdict_compact.py
```

The script downloads the upstream CSV and regenerates
`scripts/ecdict_compact.json.gz`. Internet access is required only while
rebuilding it, not while using the packaged dictionary.

### PDF.js CMaps and standard fonts

PDFs may use character maps or refer to standard fonts without embedding every
required resource. Reading Extension therefore bundles:

```text
media/pdfjs-dist/cmaps/
media/pdfjs-dist/standard_fonts/
```

The current package contains the complete PDF.js set of 169 Adobe CMaps and 16
standard-font resource files. They are used automatically when a PDF needs
them. Fonts embedded inside a PDF still come from the PDF itself.

When building from source, install npm dependencies and run:

```bash
npm install
npm run compile
```

`npm run compile` automatically runs `npm run copy:pdfjs-assets`, which
refreshes `media/pdfjs-dist/` from the installed `pdfjs-dist` npm package.

Verify the generated assets with:

```bash
find media/pdfjs-dist/cmaps -type f | wc -l
find media/pdfjs-dist/standard_fonts -type f | wc -l
```

The expected counts are 169 CMap files and 16 standard-font files.

### What is not bundled

The Argos Translate Python runtime and neural translation model are not
included in the VSIX because Python environments and native dependencies are
platform-specific. Install them separately only if you want local sentence or
paragraph translation. Offline ECDICT word lookup and the bundled PDF
resources work without Argos.

## Quick Start

1. Open the Command Palette.
2. Run **Reading Extension: Open Paper Reader**.
3. Select an existing PDF or open the command while a PDF is active.
4. Select text to open the floating annotation and translation toolbar.
5. Use the sidebar to view annotations, saved words, translation settings, and document status.

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

Restart the reader after changing the setting. The first translation starts
the local daemon and loads the model; later translations reuse that process.

### DeepSeek

1. Generate a DeepSeek API key.
2. Run **Reading Extension: Set DeepSeek API Key**, or select DeepSeek in the Translation sidebar.
3. Enter the key when prompted.

The key is stored with VS Code SecretStorage — it's never written to settings, sidecar files, logs, or the Webview.

Run **Reading Extension: Clear DeepSeek API Key** to remove it.

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
| `Reading Extension: Open Paper Reader` | Open the current PDF or select one from disk. |
| `Reading Extension: Set DeepSeek API Key` | Store or replace the DeepSeek key securely. |
| `Reading Extension: Clear DeepSeek API Key` | Remove the stored DeepSeek key. |

## Development

Requirements:

- Node.js and npm
- VS Code 1.90 or newer
- Python with Argos Translate only if local neural translation is being tested

```bash
npm install
npm run compile
npm test
```

Press `F5` in VS Code to launch an Extension Development Host.

Important generated files:

- `media/reader-app.js` and `media/reader-app.css`
- `media/pdfjs-dist/`
- `out/extension.js`

Do not edit generated files directly.

## Contributing

Issues and pull requests are welcome:

- Repository: https://github.com/WORMMMMMM/reading-extension
- Issues: https://github.com/WORMMMMMM/reading-extension/issues

Please run the following checks before submitting code:

```bash
npm test
./node_modules/.bin/tsc -p tsconfig.webview.json --noEmit
node --check media/reader-app.js
```

## Acknowledgements

Reading Extension is built with open-source projects including:

- [PDF.js](https://mozilla.github.io/pdf.js/)
- [react-pdf-highlighter-plus](https://github.com/DanielArnould/react-pdf-highlighter-plus)
- [pdf-lib](https://pdf-lib.js.org/)
- [Argos Translate](https://www.argosopentech.com/)
- [ECDICT](https://github.com/skywind3000/ECDICT)

Third-party components and bundled assets remain subject to their respective licenses.

## License

Reading Extension is released under the [MIT License](LICENSE).
