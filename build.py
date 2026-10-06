#!/usr/bin/env python3
"""Build the InkDOS advanced tools site.

Every tool is an existing open-source project, fetched at the exact commit pinned in tools.json,
built (or copied) with its own tooling and placed under <out>/<id>/ together with its licence.
Nothing is rewritten beyond what is needed to serve it from a sub-path and without CDNs.

    python build.py --out _site            # all tools
    python build.py --out _site --only id  # one tool (for local checks)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'tools.json').read_text(encoding='utf-8'))
BASE = MANIFEST['base']


def run(cmd: list[str], cwd: Path, env: dict | None = None) -> None:
    print('+', ' '.join(cmd), f'(in {cwd.name})', flush=True)
    subprocess.run(cmd, cwd=cwd, check=True, env={**os.environ, **(env or {})})


def fetch(tool: dict, work: Path) -> Path:
    src = work / tool['id']
    if (src / '.git').exists():
        head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=src, capture_output=True, text=True).stdout.strip()
        if head == tool['ref']:
            return src
        shutil.rmtree(src)
    src.mkdir(parents=True)
    run(['git', 'init', '-q'], src)
    run(['git', 'remote', 'add', 'origin', tool['repo']], src)
    run(['git', 'fetch', '-q', '--depth', '1', 'origin', tool['ref']], src)
    run(['git', 'checkout', '-q', 'FETCH_HEAD'], src)
    return src


def copy_files(src: Path, dest: Path, names: list[str]) -> None:
    for name in names:
        source = src / name
        target = dest / name
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def patch(file: Path, edits: list[tuple[str, str]]) -> None:
    """Apply exact replacements to an upstream file; fail loudly if upstream no longer matches."""
    text = file.read_text(encoding='utf-8')
    for old, new in edits:
        if new in text:
            continue  # already applied (rebuild of the same checkout)
        if text.count(old) != 1:
            sys.exit(f'{file}: expected exactly one occurrence of {old!r}')
        text = text.replace(old, new)
    file.write_text(text, encoding='utf-8')


def follow_inkdos_theme(page: Path, tool_id: str) -> None:
    """Load site-src/viewers/tool-theme.js first, so the tool starts in the InkDOS light/dark appearance."""
    text = page.read_text(encoding='utf-8')
    tag = f'<script src="../viewers/tool-theme.js" data-tool="{tool_id}"></script>'
    if tag not in text:
        if '<head>' not in text:
            sys.exit(f'{page}: no <head> to load the InkDOS theme script into')
        page.write_text(text.replace('<head>', '<head>' + tag, 1), encoding='utf-8')


def inkdos_skin(page: Path, tool_id: str, theme_script: bool = True) -> None:
    """Give a tool page the InkDOS look: site-src/skins/inkdos.css (InkDOS tokens) and skins/<tool>.css after the
    tool's own styles; viewers/viewer-theme.js first, so the tokens follow the InkDOS light/dark appearance (tools
    with their own dark class, IT-Tools and CyberChef, start in that mode through tool-theme.js instead)."""
    text = page.read_text(encoding='utf-8')
    links = (f'<link rel="stylesheet" href="{BASE}skins/inkdos.css"><link rel="stylesheet" href="{BASE}skins/{tool_id}.css">')
    if links in text:
        return
    if '<head>' not in text or '</head>' not in text:
        sys.exit(f'{page}: no <head> to add the InkDOS skin to')
    if theme_script:
        text = text.replace('<head>', f'<head><script src="{BASE}viewers/viewer-theme.js"></script>', 1)
    page.write_text(text.replace('</head>', links + '</head>', 1), encoding='utf-8')


# ---- builders: one per tool; each writes the tool's static files into `dest` -------------------

def build_archivedrop(src: Path, dest: Path, tool: dict) -> None:
    app = src / 'ArchiveDrop'
    # only what the page loads (the repository also vendors the whole Font Awesome distribution)
    copy_files(app, dest, ['index.html', 'app.js', 'styles.css', 'manifest.json', '1f4e6.png', 'sw.js',
                           'libarchive.js', 'libarchive.wasm', 'worker-bundle.js', 'css/all.min.css', 'webfonts'])
    # InkDOS wording: the archive is opened on this device, nothing is uploaded (the upstream text and cloud
    # icon read as an upload)
    patch(dest / 'app.js', [
        ('title: "ArchiveDrop",\n    subtitle: "Estrai', 'title: "Estrai ZIP, RAR e 7z",\n    subtitle: "Estrai'),
        ('dropText: "Clicca per caricare o trascina qui il file"', 'dropText: "Scegli un archivio o trascinalo qui"'),
        ('title: "ArchiveDrop",\n    subtitle: "Extract and share files privately, directly in your browser."',
         'title: "Extract ZIP, RAR and 7z",\n    subtitle: "Archives are opened on this device. Nothing is uploaded."'),
        ('dropText: "Click to upload or drag the file here"', 'dropText: "Choose an archive or drag it here"'),
    ])
    patch(dest / 'index.html', [
        ('<i class="fa-solid fa-cloud-arrow-up"></i>', '<i class="fa-solid fa-file-zipper"></i>'),
        ('<title>ArchiveDrop — Unpack & Share</title>', '<title>Extract ZIP, RAR and 7z</title>'),
    ])
    inkdos_skin(dest / 'index.html', tool['id'])


def build_cyberchef(src: Path, dest: Path, tool: dict) -> None:
    run(['npm', 'ci', '--no-audit', '--no-fund'], src)
    run(['npx', 'grunt', 'prod'], src)
    prod = src / 'build' / 'prod'
    shutil.copytree(prod, dest, dirs_exist_ok=True)
    # the standalone page is named CyberChef_v<version>.html; serve it as the tool's index
    pages = sorted(p for p in dest.glob('CyberChef_v*.html'))
    if not (dest / 'index.html').exists() and pages:
        shutil.copy2(pages[0], dest / 'index.html')
    follow_inkdos_theme(dest / 'index.html', tool['id'])
    inkdos_skin(dest / 'index.html', tool['id'], theme_script=False)
    for zipped in dest.glob('*.zip'):
        zipped.unlink()  # the downloadable standalone bundle duplicates the site
    (dest / 'BundleAnalyzerReport.html').unlink(missing_ok=True)  # build diagnostics, not part of the app


def build_it_tools(src: Path, dest: Path, tool: dict) -> None:
    # InkDOS colours instead of the IT-Tools green (with skins/it-tools.css for the sidebar header)
    patch(src / 'src' / 'ui' / 'theme' / 'themes.ts', [
        ("color: '#18a058',\n      colorHover: '#1ea54c',\n      colorPressed: '#0C7A43',\n      colorFaded: '#18a0582f',",
         "color: '#2f6fed',\n      colorHover: '#2559c7',\n      colorPressed: '#1e4aa6',\n      colorFaded: '#2f6fed2f',"),
        ("color: '#1ea54c',\n      colorHover: '#36AD6A',\n      colorPressed: '#0C7A43',\n      colorFaded: '#18a0582f',",
         "color: '#3f76ee',\n      colorHover: '#5b8ef5',\n      colorPressed: '#2f6fed',\n      colorFaded: '#3f76ee2f',"),
        ("background: '#1e1e1e',", "background: '#1c222a',"),
    ])
    patch(src / 'src' / 'themes.ts', [
        ("  Layout: { color: '#f1f5f9' },",
         "  common: {\n    primaryColor: '#2f6fedFF',\n    primaryColorHover: '#2559c7FF',\n    primaryColorPressed: '#1e4aa6FF',\n"
         "    primaryColorSuppl: '#2559c7FF',\n  },\n\n  Layout: { color: '#f2f5f8' },"),
        ("    primaryColor: '#1ea54cFF',\n    primaryColorHover: '#36AD6AFF',\n    primaryColorPressed: '#0C7A43FF',\n    primaryColorSuppl: '#36AD6AFF',",
         "    primaryColor: '#3f76eeFF',\n    primaryColorHover: '#5b8ef5FF',\n    primaryColorPressed: '#2f6fedFF',\n    primaryColorSuppl: '#5b8ef5FF',"),
        ("    color: '#1c1c1c',\n    siderColor: '#232323',", "    color: '#11161c',\n    siderColor: '#1c222a',"),
        ("    color: '#232323',\n    borderColor: '#282828',", "    color: '#1c222a',\n    borderColor: '#323c49',"),
    ])
    for theme in ('c-select/c-select.theme.ts', 'c-input-text/c-input-text.theme.ts'):
        patch(src / 'src' / 'ui' / theme, [("backgroundColor: '#1ea54c1a',", "backgroundColor: '#2f6fed1a',"),
                                           ("    backgroundColor: '#333333',\n    borderColor: '#333333',",
                                            "    backgroundColor: '#252d37',\n    borderColor: '#323c49',")])
    patch(src / 'src' / 'ui' / 'c-card' / 'c-card.theme.ts', [
        ("backgroundColor: '#232323',\n    borderColor: '#282828',", "backgroundColor: '#1c222a',\n    borderColor: '#323c49',"),
        ("backgroundColor: '#ffffff',\n    borderColor: '#efeff5',", "backgroundColor: '#ffffff',\n    borderColor: '#e3e8ef',"),
    ])
    pnpm = ['npx', '-y', 'pnpm@9.11.0']  # the version pinned by the project's packageManager field
    run(pnpm + ['install', '--frozen-lockfile'], src)
    run(pnpm + ['run', 'build'], src, env={'BASE_URL': f"{BASE}{tool['id']}/"})
    shutil.copytree(src / 'dist', dest, dirs_exist_ok=True)
    follow_inkdos_theme(dest / 'index.html', tool['id'])
    inkdos_skin(dest / 'index.html', tool['id'], theme_script=False)


def build_pnk(src: Path, dest: Path, tool: dict) -> None:
    # needs cargo with the wasm32-unknown-unknown target and wasm-bindgen 0.2.127 on PATH
    # the viewer's only outbound request is an opt-out setting that asks Google Fonts for substitutes
    # of the fonts a document names; InkDOS tools make no network requests unless the user asks, so
    # the default is flipped to off (the setting stays available in the viewer)
    patch(src / 'viewer' / 'src' / 'webfonts.ts', [
        ('return window.localStorage.getItem(SETTING_KEY) !== "0";', 'return window.localStorage.getItem(SETTING_KEY) === "1";'),
        ('// Storage can throw (private mode, blocked site data). Default is on.\n    return true;',
         '// Storage can throw (private mode, blocked site data). Default is off.\n    return false;'),
    ])
    run(['npm', 'ci', '--no-audit', '--no-fund'], src / 'viewer')
    run(['bash', 'scripts/build_viewer.sh'], src)
    shutil.copytree(src / 'viewer' / 'dist', dest, dirs_exist_ok=True)
    shutil.copy2(src / 'LICENSE-APACHE', dest / 'UPSTREAM-LICENSE-APACHE.txt')
    # InkDOS embed mode (site-src/viewers/): follow the InkDOS theme and accept a file handed over by
    # an InkDOS workspace; pnk's own code is unchanged
    patch(dest / 'index.html', [
        ('<link rel="stylesheet" href="styles.css">',
         '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="../viewers/pnk-embed.css">\n'
         '  <script src="../viewers/viewer-theme.js"></script>'),
        ('</body>', '<script src="../viewers/pnk-embed.js"></script>\n<script src="../viewers/viewer-embed.js"></script>\n</body>'),
    ])


def build_odf(src: Path, dest: Path, tool: dict) -> None:
    # WebODF's own cmake build (closure compiler) produces webodf.js. Its 2016 build scripts use
    # Node APIs that later Node versions reject, so they run on Node 6 from the npm registry.
    node6 = src.parent / 'node6'
    if not (node6 / 'node_modules' / 'node').exists():
        node6.mkdir(parents=True, exist_ok=True)
        run(['npm', 'install', '--no-audit', '--no-fund', '--prefix', str(node6), 'node@6.17.1'], node6)
    node = (node6 / 'node_modules' / 'node' / 'bin' / 'node').resolve()
    build = src.parent / f"{tool['id']}-build"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir(parents=True)
    env = {'PATH': f"{node.parent}{os.pathsep}{os.environ['PATH']}"}
    # a shallow fetch has no tags for WebODF's git-describe version check; the pinned commit is v0.5.10
    run(['cmake', f'-DNODE={node}', '-DOVERRULED_WEBODF_VERSION=0.5.10', str(src)], build, env=env)
    run(['make', 'webodf.js-target'], build, env=env)
    shutil.copy2(build / 'webodf' / 'webodf.js', dest / 'webodf.js')
    # the viewer page around WebODF's OdfCanvas (site-src/odf/)
    copy_files(ROOT / 'site-src' / 'odf', dest, ['index.html', 'viewer.js'])


def npm_pack(specs: list[str], into: Path) -> list[Path]:
    """Download npm packages as tarballs (no install scripts run) and return their paths."""
    into.mkdir(parents=True, exist_ok=True)
    out = subprocess.run(['npm', 'pack', '--silent', *specs], cwd=into, check=True, capture_output=True, text=True).stdout
    return [into / name for name in out.split()]


def untar(tgz: Path, dest: Path, inner: str = '') -> None:
    """Extract package/<inner> of an npm tarball into dest."""
    with tarfile.open(tgz) as tar:
        prefix = 'package/' + (inner.strip('/') + '/' if inner else '')
        for member in tar.getmembers():
            if not member.isfile() or not member.name.startswith(prefix):
                continue
            target = dest / member.name[len(prefix):]
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as data:
                target.write_bytes(data.read())


def build_bentopdf(src: Path, dest: Path, tool: dict) -> None:
    # Self-hosted ("simple mode") build with every runtime asset served from this site, following the
    # project's own air-gap recipe (scripts/prepare-airgap.sh): no CDN, no GitHub API call.
    base = f"{BASE}{tool['id']}/"
    wasm = base + 'wasm'
    versions = dict(re.findall(r"(\w+): '([^']+)'", (src / 'src/js/const/cdn-version.ts').read_text(encoding='utf-8')))
    lock = json.loads((src / 'package-lock.json').read_text(encoding='utf-8'))['packages']
    tesseract, tesseract_core = lock['node_modules/tesseract.js']['version'], lock['node_modules/tesseract.js-core']['version']
    cpdf = re.search(r"coherentpdf@([\d.]+)/", (src / 'src/js/utils/wasm-provider.ts').read_text(encoding='utf-8')).group(1)
    languages = ['eng', 'por']
    env = {
        'BASE_URL': base, 'SIMPLE_MODE': 'true', 'DISABLE_GITHUB_STARS': 'true', 'COMPRESSION_MODE': 'o',
        'SITE_URL': f"https://vfydr2m9wk-ops.github.io{base}", 'HUSKY': '0', 'NODE_OPTIONS': '--max-old-space-size=4096',
        'VITE_WASM_PYMUPDF_URL': f'{wasm}/pymupdf/', 'VITE_WASM_GS_URL': f'{wasm}/gs/', 'VITE_WASM_CPDF_URL': f'{wasm}/cpdf/',
        'VITE_TESSERACT_WORKER_URL': f'{wasm}/ocr/worker.min.js', 'VITE_TESSERACT_CORE_URL': f'{wasm}/ocr/core',
        'VITE_TESSERACT_LANG_URL': f'{wasm}/ocr/lang-data', 'VITE_TESSERACT_AVAILABLE_LANGUAGES': ','.join(languages),
        'VITE_OCR_FONT_BASE_URL': f'{wasm}/ocr/fonts', 'VITE_EMBEDPDF_FONTS_URL': f'{wasm}/embedpdf',
        # the project's own branding options (docs/self-hosting): InkDOS name and PDF icon, upstream credit in the footer
        'VITE_BRAND_NAME': 'InkDOS PDF', 'VITE_BRAND_LOGO': 'images/inkdos-pdf.svg',
        'VITE_FOOTER_TEXT': f"Based on BentoPDF ({tool['license']}), source: {tool['repo']}",
    }
    shutil.copy2(ROOT / 'site-src' / 'skins' / 'pdf.svg', src / 'public' / 'images' / 'inkdos-pdf.svg')
    run(['npm', 'ci', '--no-audit', '--no-fund'], src, env={'HUSKY': '0'})
    run(['npx', 'vite', 'build'], src, env=env)
    shutil.copytree(src / 'dist', dest, dirs_exist_ok=True)
    packs = src.parent / f"{tool['id']}-packs"
    shutil.rmtree(packs, ignore_errors=True)
    tgz = dict(zip(['pymupdf', 'gs', 'cpdf', 'tess', 'core', 'latin', *languages], npm_pack([
        f"@bentopdf/pymupdf-wasm@{versions['pymupdf']}", f"@bentopdf/gs-wasm@{versions['ghostscript']}", f'coherentpdf@{cpdf}',
        f'tesseract.js@{tesseract}', f'tesseract.js-core@{tesseract_core}', '@embedpdf/fonts-latin@1.0.0',
        *[f'@tesseract.js-data/{lang}' for lang in languages]], packs)))
    out = dest / 'wasm'
    untar(tgz['pymupdf'], out / 'pymupdf')
    untar(tgz['gs'], out / 'gs', 'assets')
    untar(tgz['cpdf'], out / 'cpdf', 'dist')
    untar(tgz['tess'], out / 'ocr', 'dist')
    untar(tgz['core'], out / 'ocr' / 'core')
    untar(tgz['latin'], out / 'embedpdf' / 'fonts-latin@1.0.0')
    for lang in languages:
        untar(tgz[lang], out / 'ocr' / 'lang-data', '4.0.0_best_int')
    font = re.search(r"'Noto Sans':\s*'([^']+)'", (src / 'src/js/config/font-mappings.ts').read_text(encoding='utf-8')).group(1)
    # the OCR text-layer font the project pins (Noto Sans Regular, OFL) is the same file @embedpdf/fonts-latin ships
    (out / 'ocr' / 'fonts').mkdir(parents=True, exist_ok=True)
    shutil.copy2(out / 'embedpdf' / 'fonts-latin@1.0.0' / 'fonts' / 'NotoSans-Regular.ttf', out / 'ocr' / 'fonts' / font.rsplit('/', 1)[1])
    # GitHub Pages cannot send COOP/COEP headers; LibreOffice WASM (Office/ODF to PDF) needs SharedArrayBuffer,
    # so the project's own service worker adds them to pages and worker scripts (coi-serviceworker technique)
    sw = dest / 'sw.js'
    sw.write_text(COI_PRELUDE + sw.read_text(encoding='utf-8'), encoding='utf-8')
    reload = COI_RELOAD.replace('SW_URL', json.dumps(base + 'sw.js'))
    for page in dest.rglob('*.html'):
        text = page.read_text(encoding='utf-8')
        if '<head>' in text and reload not in text:
            page.write_text(text.replace('<head>', '<head>' + reload, 1), encoding='utf-8')
        if '<head>' in text and '</head>' in text:
            # page titles name the upstream brand directly (the branding options cover header and footer)
            title = re.sub(r'<title>(.*?)</title>', lambda m: m.group(0).replace('BentoPDF', 'InkDOS PDF'),
                           page.read_text(encoding='utf-8'), count=1, flags=re.S)
            page.write_text(title, encoding='utf-8')
            inkdos_skin(page, tool['id'])


COI_PRELUDE = """// InkDOS-tools: add cross-origin isolation headers to pages and worker scripts (GitHub Pages cannot send them).
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const isolated = request.mode === 'navigate' || request.destination === 'worker' || request.destination === 'sharedworker';
  if (!isolated || new URL(request.url).origin !== location.origin) return;
  event.stopImmediatePropagation();
  event.respondWith((async () => {
    let response;
    try { response = await fetch(request); if (response.ok) (await caches.open('inkdos-tools-pages')).put(request, response.clone()); }
    catch (error) { response = await caches.match(request); if (!response) throw error; }
    if (!response || response.type === 'opaqueredirect' || response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  })());
});
"""
COI_RELOAD = ("<script>/* InkDOS-tools: register the tool's service worker from any page (the project registers it from "
              "its start page only) and reload once so the page becomes cross-origin isolated */"
              "if(!self.crossOriginIsolated&&'serviceWorker' in navigator){navigator.serviceWorker.register(SW_URL).catch(function(){});"
              "navigator.serviceWorker.ready.then(function(){"
              "try{if(sessionStorage.getItem('inkdos-coi'))return;sessionStorage.setItem('inkdos-coi','1')}catch(_){return}"
              "location.reload()})}</script>")


def build_python(src: Path, dest: Path, tool: dict) -> None:
    # Pyodide's own console page from its npm release (the commit pinned in tools.json is that release's
    # tag); the terminal libraries it loads from CDNs are served from this site instead
    version = '314.0.7'
    packs = src.parent / f"{tool['id']}-packs"
    shutil.rmtree(packs, ignore_errors=True)
    pyodide, jquery, terminal, idb = npm_pack([f'pyodide@{version}', 'jquery@3.7.1', 'jquery.terminal@2.35.2', 'idb-keyval@5.0.2'], packs)
    untar(pyodide, dest)
    vendor = dest / 'vendor'
    untar(jquery, vendor / 'jquery')  # whole packages, so each keeps its licence file
    untar(terminal, vendor / 'jquery.terminal')
    untar(idb, vendor / 'idb-keyval')
    shutil.copy2(dest / 'console.html', dest / 'index.html')
    inkdos_skin(dest / 'index.html', tool['id'])
    patch(dest / 'index.html', [
        ('https://cdn.jsdelivr.net/npm/jquery.terminal@2.35.2/css/jquery.terminal.min.css', './vendor/jquery.terminal/css/jquery.terminal.min.css'),
        ('https://cdn.jsdelivr.net/npm/jquery.terminal@2.35.2/js/jquery.terminal.min.js', './vendor/jquery.terminal/js/jquery.terminal.min.js'),
        ('https://cdn.jsdelivr.net/npm/jquery.terminal@2.35.2/js/unix_formatting.min.js', './vendor/jquery.terminal/js/unix_formatting.min.js'),
        ('https://cdn.jsdelivr.net/npm/jquery@3.7.1', './vendor/jquery/dist/jquery.min.js'),
        ('https://unpkg.com/idb-keyval@5.0.2/dist/esm/index.js', './vendor/idb-keyval/dist/esm/index.js'),
    ])


BUILDERS = {
    'archivedrop': build_archivedrop,
    'cyberchef': build_cyberchef,
    'it-tools': build_it_tools,
    'pnk': build_pnk,
    'bentopdf': build_bentopdf,
    'python': build_python,
    'odf': build_odf,
}


def write_index(out: Path, tools: list[dict]) -> None:
    listing = [{k: t[k] for k in ('id', 'name', 'title', 'group', 'description', 'repo', 'license')} | {'href': f"{t['id']}/"}
               for t in tools]
    (out / 'tools.json').write_text(json.dumps({'tools': listing}, indent=2) + '\n', encoding='utf-8')
    template = (ROOT / 'site-src' / 'index.html').read_text(encoding='utf-8')
    items = '\n'.join(
        f'      <li><a href="./{t["id"]}/"><strong>{t["title"]}</strong><small>{t["description"]}</small>'
        f'<em>{t["name"]} · {t["license"]}</em></a></li>' for t in tools)
    (out / 'index.html').write_text(template.replace('<!-- TOOLS -->', items), encoding='utf-8')
    shutil.copy2(ROOT / 'LICENSE', out / 'LICENSE.txt')
    # shared by the viewers: InkDOS look, theme and the embed protocol (site-src/viewers/)
    shutil.copytree(ROOT / 'site-src' / 'viewers', out / 'viewers', dirs_exist_ok=True)
    # the InkDOS look for the tools' own pages (inkdos_skin)
    shutil.copytree(ROOT / 'site-src' / 'skins', out / 'skins', dirs_exist_ok=True)
    (out / '.nojekyll').write_text('', encoding='utf-8')
    # GitHub Pages serves one 404 page per site: send a deep link inside a tool (single-page apps with
    # history routing, e.g. IT-Tools) back to that tool's start page instead of a dead end
    ids = json.dumps([t['id'] for t in tools])
    (out / '404.html').write_text(
        '<!doctype html><meta charset="utf-8"><title>InkDOS tools</title>\n'
        f'<script>(function(){{var base={json.dumps(BASE)},ids={ids},rest=location.pathname.indexOf(base)===0?'
        'location.pathname.slice(base.length):"",id=rest.split("/")[0];'
        'location.replace(base+(ids.indexOf(id)>=0?id+"/":""))})()</script>\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='_site')
    parser.add_argument('--work', default='.work')
    parser.add_argument('--only', action='append', default=[])
    args = parser.parse_args()
    out, work = Path(args.out).resolve(), Path(args.work).resolve()
    tools = [t for t in MANIFEST['tools'] if not args.only or t['id'] in args.only]
    unknown = set(args.only) - {t['id'] for t in MANIFEST['tools']}
    if unknown:
        sys.exit(f'Unknown tool(s): {", ".join(sorted(unknown))}')
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    for tool in tools:
        dest = out / tool['id']
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        src = fetch(tool, work)
        BUILDERS[tool['id']](src, dest, tool)
        shutil.copy2(src / tool['license_file'], dest / 'UPSTREAM-LICENSE.txt')
        (dest / 'UPSTREAM-SOURCE.txt').write_text(f"{tool['name']}\n{tool['repo']}\ncommit {tool['ref']}\nlicense {tool['license']}\n",
                                                  encoding='utf-8')
        if not (dest / 'index.html').exists():
            sys.exit(f"{tool['id']}: build produced no index.html")
        print(f"built {tool['id']}", flush=True)
    write_index(out, [t for t in MANIFEST['tools'] if (out / t['id'] / 'index.html').exists()])


if __name__ == '__main__':
    main()
