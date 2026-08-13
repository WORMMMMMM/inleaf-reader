<div align="center">
  <img src="assets/inleaf-reader-logo.png" width="112" alt="Inleaf Reader logo">
  <h1>Inleaf Reader</h1>
  <p><strong>Your Books. Your AI. Your Flow.</strong></p>
  <p>在 VS Code 里阅读 PDF，用你自己的 AI 随时提问，让思考不断流。</p>
</div>

![Inleaf Reader showing a PDF, highlights, annotations, translation, and vocabulary tools](assets/inleaf-reader-hero.png)

## What is Inleaf Reader?

Inleaf Reader turns VS Code into a focused reading space for papers and books.
It keeps frequent actions close to the page and lets you use the AI tools you
already trust beside your document. You can ask for background, investigate a
question, annotate a passage, translate text, or save a word without repeatedly
leaving the reading context.

Your reading data stays in ordinary files next to the PDF. This means it remains
under your control, can be backed up or synchronized with the tools you already
use, and is straightforward for AI tools to inspect and work with.

### At a glance

- **Read comfortably:** continuous scrolling, page progress, fit controls, and trackpad zoom.
- **Bring your own AI:** work beside Codex, Claude Code, or another assistant instead of being locked into a paid reader-specific AI.
- **Annotate in place:** highlight, underline, add notes and tags, then edit them beside the original text.
- **Translate as you read:** use the bundled offline dictionary, local Argos Translate, DeepSeek, or LibreTranslate.
- **Build a wordbook:** save useful English words and their structured definitions for each PDF.
- **Keep data AI-ready:** annotations, vocabulary, exports, and progress use portable files beside the document.
- **Stay focused:** the side panel starts hidden and appears only when you ask for it.

## Who is it for?

Inleaf Reader is especially useful if you:

- read papers or technical books while working in VS Code;
- want annotations and progress to stay with the original PDF;
- use coding assistants such as Codex or Claude Code beside your reading window;
- prefer offline or user-controlled tools over a mandatory cloud account.

## Install

### From a VSIX

Download the VSIX from the
[latest GitHub release](https://github.com/WORMMMMMM/inleaf-reader/releases/latest),
then choose **Extensions: Install from VSIX...** in VS Code.

You can also install it from a terminal:

```bash
code --install-extension inleaf-reader-0.0.8.vsix
```

After installation, run **Developer: Reload Window** once if the reader command
does not appear immediately.

> **Moving from an earlier pre-Inleaf build?** VS Code treats the current
> `ziming.inleaf-reader` identity as a separate extension. Install Inleaf Reader,
> remove the earlier extension, and reopen each PDF once. Existing local
> sidecars beside that PDF are copied into `.inleaf-reader/` without overwriting
> current files. Provider settings and API keys should be configured again.

### From the VS Code Marketplace

When the public Marketplace release is available, search for **Inleaf Reader**
in the Extensions view and select **Install**.

## Start reading in three steps

1. Open a PDF in VS Code, then click the blue nested-book icon in the editor title bar. You can also right-click the PDF and choose **Inleaf Reader: Open Paper Reader**.
2. Select text to highlight it, underline it, write a note, translate it, or save a word.
3. Continue reading. Annotations and page progress are saved automatically—there is no separate Save button.

The right panel stays hidden at startup. Open it from the reader toolbar when
you want to browse annotations, saved words, or translation settings.

## What happens to my data?

For a document named `paper.pdf`, Inleaf Reader creates a `.inleaf-reader`
folder beside it:

```text
.inleaf-reader/
  paper.pdf.annotations.json   # highlights, underlines, notes, and tags
  paper.pdf.annotations.md     # Markdown export
  paper.pdf.annotated.pdf      # PDF export with visible marks and comments
  paper.pdf.wordbook.json      # saved words
  paper.pdf.progress.json      # last reading position
```

These are normal local files. You can copy or synchronize them through Git,
iCloud Drive, Dropbox, Syncthing, or another file-sync tool. JSON updates are
written atomically, and the previous valid version may be kept as a `.bak`
recovery file. Because the formats are structured and documented, an AI tool
with access to your workspace can reuse your annotations and vocabulary without
depending on a proprietary cloud database.

If a PDF is moved or renamed, a lightweight content fingerprint helps Inleaf
Reader find and copy its missing sidecar files. Existing files at the new
location are never overwritten.

## Translation choices

| Mode | Best for | Network or setup |
| --- | --- | --- |
| Bundled ECDICT | Looking up one English word | Offline, no setup |
| Argos Translate | Local sentence and paragraph translation | Offline after installing Python and a language model |
| DeepSeek | Higher-quality academic translation | Uses your own API key and sends selected text to DeepSeek |
| LibreTranslate | A self-hosted or compatible translation service | Sends selected text to the endpoint you configure |

Single English words always prefer the bundled ECDICT dictionary, which contains
about 770,000 entries and can show phonetics, Chinese meanings, English
definitions, parts of speech, and word forms. It loads in a background worker
only when needed, so ordinary PDF startup does not wait for the dictionary.

### DeepSeek

Run **Inleaf Reader: Set DeepSeek API Key** or select DeepSeek in the Translation
panel. The key is stored in VS Code SecretStorage and is never written to the
Webview, settings, sidecar files, or logs.

Run **Inleaf Reader: Clear DeepSeek API Key** to remove it.

### LibreTranslate

Set `inleafReader.translationProvider` to `libretranslate` and provide a
compatible endpoint in `inleafReader.libreTranslateEndpoint`.

<details>
<summary><strong>Optional: set up local Argos Translate</strong></summary>

The VSIX does not include Python or the Argos neural model because those
dependencies are specific to each operating system.

On macOS or Linux:

```bash
python3 -m venv ~/.inleaf-reader-argos
source ~/.inleaf-reader-argos/bin/activate
python -m pip install --upgrade pip argostranslate
```

On Windows PowerShell:

```powershell
py -m venv $HOME\.inleaf-reader-argos
& $HOME\.inleaf-reader-argos\Scripts\Activate.ps1
python -m pip install --upgrade pip argostranslate
```

Install the English-to-Chinese model with the
[official Argos package API](https://github.com/argosopentech/argos-translate):

```python
import argostranslate.package

argostranslate.package.update_package_index()
packages = argostranslate.package.get_available_packages()
package = next(
    item for item in packages
    if item.from_code == "en" and item.to_code == "zh"
)
argostranslate.package.install_from_path(package.download())
```

Then set `inleafReader.argosPythonPath` to that virtual environment's
Python executable. For example:

```json
{
  "inleafReader.translationProvider": "argos",
  "inleafReader.argosPythonPath": "/Users/you/.inleaf-reader-argos/bin/python"
}
```

The first sentence translation starts the local daemon and loads the model.
Later requests reuse that process.

</details>

If translation does not work, run
**Inleaf Reader: Diagnose Translation Setup** to see what is available.

## Privacy

- Inleaf Reader does not currently collect telemetry or analytics.
- PDFs and all reading sidecars stay in paths you choose.
- Offline ECDICT lookup and local Argos translation stay on your machine.
- DeepSeek and LibreTranslate receive selected text only when you choose those providers.
- A lightweight path index is stored in VS Code global state for move/rename recovery; annotation and wordbook content is not stored there.

Review the privacy terms of any external translation provider before sending
sensitive text.

## Current limitations

- Scanned PDFs without a text layer cannot be selected unless OCR is performed separately.
- Header, footer, page-number, and figure exclusion is heuristic because many PDFs do not expose reliable document structure.
- Argos Translate requires separate Python and language-model installation.
- The current dictionary and local translation workflow are optimized for English-to-Chinese reading.
- Inleaf Reader is still in preview; keep important PDFs and sidecar data backed up.

## Commands

| Command | What it does |
| --- | --- |
| `Inleaf Reader: Open Paper Reader` | Opens the active PDF or lets you choose one. |
| `Inleaf Reader: Set DeepSeek API Key` | Stores or replaces a DeepSeek key securely. |
| `Inleaf Reader: Clear DeepSeek API Key` | Removes the stored DeepSeek key. |
| `Inleaf Reader: Diagnose Translation Setup` | Checks dictionary and translation readiness. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, tests, and the manual
reader checklist. Issues and pull requests are welcome on
[GitHub](https://github.com/WORMMMMMM/inleaf-reader).

## Built with

- [PDF.js](https://mozilla.github.io/pdf.js/)
- [react-pdf-highlighter-plus](https://github.com/DanielArnould/react-pdf-highlighter-plus)
- [pdf-lib](https://pdf-lib.js.org/)
- [Argos Translate](https://www.argosopentech.com/)
- [ECDICT](https://github.com/skywind3000/ECDICT)

Third-party components and bundled assets remain subject to their respective
licenses.

## License

Inleaf Reader 0.0.8 and later is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Personal, educational,
research, and other noncommercial use is permitted. Commercial use requires
separate written authorization from the copyright holder.

Versions 0.0.7 and earlier remain available under the MIT License terms that
were granted with those releases. Changing the license for newer versions does
not revoke rights already granted for earlier versions.
