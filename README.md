# InkDOS advanced tools

Open-source tools for [InkDOS](https://github.com/vfydr2m9wk-ops/InkDOS), served at
<https://vfydr2m9wk-ops.github.io/inkdos-tools/> and opened from InkDOS's **Advanced tools** menu.

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

Changes to upstream are limited to what `build.py` states next to each builder: pnk's optional
Google Fonts substitutes are off by default (the setting stays in the viewer), so no tool makes a
network request unless the user turns one on.

## Build

```
python build.py --out _site              # all tools
python build.py --out _site --only cyberchef
```

Requirements: git, Python 3.11+, Node.js 24 with npm (IT-Tools runs its pinned pnpm through npx; pnk needs Rust with the `wasm32-unknown-unknown` target and `wasm-bindgen-cli` 0.2.127).
The site is deployed by `.github/workflows/pages.yml` (Settings → Pages → Source: **GitHub Actions**).

## Licences

The glue code in this repository (build script, landing page, workflow) is MIT. Each tool keeps its
upstream licence; tools under copyleft licences (for example GPL or AGPL) are distributed as separate
programs with their licence and a link to their source.
