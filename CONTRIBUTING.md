# Contributing

Unless you explicitly state otherwise, contributions intentionally submitted
for inclusion in this project are provided under the
[Apache License 2.0](LICENSE), as described in Section 5 of that license.

## Local setup

Use Node.js 20.19 or newer (Node.js 22.12+ is also supported). If you use
`nvm`, the repository includes an `.nvmrc`:

```bash
nvm use
```

```bash
npm ci
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host, then run
`Inleaf Reader: Open Paper Reader` with a normal text PDF.

Argos is optional for development. Offline dictionary lookup uses the bundled
sharded ECDICT data through a Node worker and does not require Python.

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
