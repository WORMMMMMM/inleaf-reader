# Contributing

Unless you explicitly state otherwise, contributions intentionally submitted
for inclusion in this project are provided under the
[Apache License 2.0](LICENSE), as described in Section 5 of that license.

## Local setup

On macOS or Linux, one command installs nothing globally, compiles the project,
and opens an Extension Development Host:

```bash
./dev
```

The launcher selects a working Node.js 20.19+ or 22.12+ executable, installs
missing local dependencies, and also avoids a
broken default `node` shim. On Windows, or when you prefer npm directly, use:

```bash
npm install
npm run dev
```

In the new VS Code window, run `Inleaf Reader: Quick Start`. After source
changes, rerun `npm run compile` and use `Developer: Reload Window` in the
Extension Development Host.

To install or update the current checkout in ordinary VS Code instead of using
an Extension Development Host, run:

```bash
./install
```

Reload open VS Code windows once after installation. From then on, open any PDF
and click the Inleaf book icon in its editor title bar; no development service
needs to remain running.

Argos is optional for development. Offline dictionary lookup uses the bundled
ECDICT file through a Node worker and does not require Python.

## Checks

Use the fast checks while editing:

```bash
npm run typecheck
npm run test:unit
```

Before submitting a change, run:

```bash
npm test
```

This rebuilds packaged assets, runs export, identity, and dictionary-worker
regressions, type-checks both extension and Webview code, and validates the
generated Webview JavaScript.

Reader UI changes also require the manual checks listed in `AGENTS.md`,
including opening a real-text PDF, selecting text, autosaving annotations,
restoring progress, and testing both word and sentence translation paths.

Do not commit `node_modules/`, `.venv-translate/`, `out/`, user PDFs, VSIX
packages, or runtime `.inleaf-reader/` data.
