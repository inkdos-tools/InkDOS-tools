# InkDOS advanced tools

Open-source tools for [InkDOS](https://github.com/vfydr2m9wk-ops/InkDOS), served at
<https://inkdos-tools.github.io/InkDOS-tools/> and opened from InkDOS's **Advanced tools** menu.
The site is deliberately a separate origin from InkDOS (`vfydr2m9wk-ops.github.io`), so the tools'
third-party code cannot reach InkDOS's storage or pages.

Every tool is an existing open-source project that runs entirely in the browser: files are processed
on the device and never uploaded. Nothing here is written from scratch. `build.py` fetches each project
at the commit pinned in `tools.json`, builds it with its own tooling and places it under `/<id>/`
together with its licence (`UPSTREAM-LICENSE.txt`) and source reference (`UPSTREAM-SOURCE.txt`).

| Tool | Upstream | Licence |
|---|---|---|
| Extract ZIP, RAR and 7z | [ArchiveDrop](https://github.com/R0mb0/ArchiveDrop) | MIT |
| Data toolbox | [CyberChef](https://github.com/gchq/CyberChef) | Apache-2.0 |
| Developer utilities | [IT-Tools](https://github.com/CorentinTh/it-tools) | GPL-3.0 |
| Apple Pages, Numbers and Keynote viewer | [pnk](https://github.com/peterheb/pnk) | MIT or Apache-2.0 |
| PDF toolkit, Office/LibreOffice to PDF | [BentoPDF](https://github.com/alam00000/bentopdf) | AGPL-3.0 |
| Python terminal (numpy, pandas, matplotlib…) | [Pyodide](https://github.com/pyodide/pyodide) console | MPL-2.0 |
| OpenDocument viewer (.odt/.ods/.odp) | [WebODF](https://github.com/kogmbh/WebODF) | AGPL-3.0 |
| Image converter and compressor | [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | Apache-2.0 |

Changes to upstream are limited to what `build.py` states next to each builder: pnk's optional
Google Fonts substitutes are off by default (the setting stays in the viewer), so no tool makes a
network request unless the user turns one on.

- **BentoPDF** is built as the project's self-hosted ("simple mode") build with every runtime asset
  (PyMuPDF, Ghostscript and CoherentPDF WASM, Tesseract OCR with English and Portuguese, fonts) served
  from this site, following the project's own air-gap recipe. GitHub Pages cannot send the COOP/COEP
  headers that LibreOffice WASM (Office/ODF to PDF) needs, so a short prelude in BentoPDF's own service
  worker adds them to worker scripts and to the pages whose tool loads LibreOffice (found at build time);
  such a page reloads once the first time to become cross-origin isolated. Every other tool page stays a
  plain page (on iOS Safari, isolated tool pages opened from the start page went straight back to it).
- **Viewers for InkDOS workspaces**: `odf/` (WebODF's `OdfCanvas` with a small page in `site-src/odf/`)
  and `pnk/` accept a file handed over by an InkDOS workspace (`?embed=1`, same origin, protocol in
  `site-src/viewers/viewer-embed.js`) and follow the InkDOS light/dark appearance. WebODF is built
  with its own cmake build; its 2016 scripts run on Node 6 from the npm registry.
- **Pyodide**'s console loads jQuery, jQuery Terminal and idb-keyval from CDNs; they are served from
  `python/vendor/` instead, each with its licence. numpy, pandas, matplotlib, scipy, statsmodels, sympy,
  networkx, pillow, openpyxl, python-docx and a few more (`PYTHON_PACKAGES`, `PYPI_WHEELS` in `build.py`,
  each checked by sha256) are served from `python/` and load on import, offline. An InkDOS bar opens files
  from the device into Python and saves files back. `python/online.html` is the same terminal allowed to
  reach PyPI, so `micropip.install()` works there (the user is asked first); see `SECURITY.md`.
- **Squoosh** is served from `squoosh/` instead of the site root; its Google Analytics script and its
  offline service worker are left out.

## Build

```
python build.py --out _site              # all tools
python build.py --out _site --only cyberchef
```

Requirements: git, Python 3.11+, Node.js 24 with npm (IT-Tools runs its pinned pnpm through npx; pnk needs Rust with the `wasm32-unknown-unknown` target and `wasm-bindgen-cli` 0.2.127).
The site is built by `.github/workflows/pages.yml` and published to the `gh-pages` branch (Settings → Pages → Source: **Deploy from a branch**, `gh-pages`, `/`).

## Licences

The glue code in this repository (build script, landing page, workflow) is MIT. Each tool keeps its
upstream licence; tools under copyleft licences (for example GPL or AGPL) are distributed as separate
programs with their licence and a link to their source.
