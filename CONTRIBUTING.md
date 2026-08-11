# Contributing

## Local setup

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host, then run
`Inleaf Reader: Open Paper Reader` with a normal text PDF.

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
packages, or runtime `.reading-extension/` data.
