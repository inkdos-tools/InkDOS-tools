// InkDOS-tools: keep the Python terminal on this device (scope: python/). build.py writes the build version and the
// file lists. Install stores the terminal (Pyodide, its standard library, the InkDOS bar and skins) and then every
// bundled package (numpy, pandas, ...), so the terminal and `import` work with no network; a package that could not be
// stored then is stored the first time it is loaded. Pages ask the network first (so a new build reaches them) and
// fall back to the stored copy; every other file comes from the stored copy. A new build replaces the old copy.
'use strict';
const VERSION = 'c0f18bc1eff06bbf';
const CACHE = 'inkdos-python-' + VERSION;
const CORE = ["./", "index.html", "online.html", "inkdos-python.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "vendor/jquery/dist/jquery.min.js", "vendor/jquery.terminal/js/jquery.terminal.min.js", "vendor/jquery.terminal/css/jquery.terminal.min.css", "vendor/idb-keyval/dist/esm/index.js", "../viewers/viewer-theme.js", "../viewers/download-fallback.js", "../skins/inkdos.css", "../skins/python.css"];
const PACKAGES = ["beautifulsoup4-4.14.3-py3-none-any.whl", "contourpy-1.3.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "cycler-0.12.1-py3-none-any.whl", "decorator-5.2.1-py3-none-any.whl", "et_xmlfile-2.0.0-py3-none-any.whl", "fonttools-4.62.1-py3-none-any.whl", "kiwisolver-1.5.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "lxml-6.1.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "matplotlib-3.10.8-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "micropip-0.11.1-py3-none-any.whl", "mpmath-1.4.1-py3-none-any.whl", "networkx-3.6.1-py3-none-any.whl", "numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "openpyxl-3.1.5-py2.py3-none-any.whl", "packaging-26.1-py3-none-any.whl", "pandas-3.0.2-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "patsy-1.0.2-py2.py3-none-any.whl", "pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "pyparsing-3.3.2-py3-none-any.whl", "python_dateutil-2.9.0.post0-py2.py3-none-any.whl", "python_docx-1.2.0-py3-none-any.whl", "pytz-2026.1.post1-py2.py3-none-any.whl", "pyyaml-6.0.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "regex-2026.3.32-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "setuptools-82.0.1-py3-none-any.whl", "six-1.17.0-py2.py3-none-any.whl", "soupsieve-2.8.3-py3-none-any.whl", "statsmodels-0.14.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl", "sympy-1.14.0-py3-none-any.whl", "typing_extensions-4.15.0-py3-none-any.whl", "xlrd-2.0.2-py2.py3-none-any.whl"];
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map(scoped)); // the terminal itself must be complete
    for (const file of PACKAGES) { // packages: best effort, one at a time (memory on iPad)
      try { await cache.add(scoped(file)); } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('inkdos-python-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return; // the page also loads the shared skins
  if (request.mode === 'navigate') {
    if (!url.href.startsWith(self.registration.scope)) return;
    event.respondWith((async () => {
      const page = new URL(url.pathname, url.origin).href; // stored without the query (?inkdos-theme=)
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE)).put(page, response.clone());
        return response;
      } catch (error) {
        const stored = await caches.match(page, { cacheName: CACHE });
        if (stored) return stored;
        throw error;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const stored = await cache.match(request, { ignoreSearch: true });
    if (stored) return stored;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  })());
});
