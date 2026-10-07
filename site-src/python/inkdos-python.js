// InkDOS additions to the Pyodide console (python/index.html and python/online.html): a bar to open files from
// this device into Python's file system and to save files from it, and the switch between the offline terminal
// and the online one (which may install packages from PyPI). Pyodide's own console code is unchanged.
(function () {
  'use strict';
  const doc = document;
  const ONLINE = doc.documentElement.dataset.inkdosPython === 'online';
  const HOME = '/home/pyodide';
  const theme = new URLSearchParams(location.search).get('inkdos-theme');
  const withTheme = (page) => page + (theme ? '?inkdos-theme=' + encodeURIComponent(theme) : '');
  const safe = (text) => String(text).replaceAll('[[', '&lsqb;&lsqb;').replaceAll(']]', '&rsqb;&rsqb;');

  const bar = doc.createElement('div');
  bar.id = 'inkdos-python-bar';
  bar.innerHTML = '<button type="button" data-open disabled>Open file…</button>'
    + '<button type="button" data-save disabled>Save file…</button>'
    + '<span class="inkdos-python-note"></span><a class="inkdos-python-mode" href="#"></a>'
    + '<input type="file" multiple hidden>';
  const note = bar.querySelector('.inkdos-python-note');
  const mode = bar.querySelector('.inkdos-python-mode');
  const picker = bar.querySelector('input');
  note.textContent = ONLINE
    ? 'Online: micropip can install packages from PyPI. They run only in this tab.'
    : 'Offline: everything comes from this site. Files stay on this device.';
  mode.textContent = ONLINE ? 'Back to the offline terminal' : 'Allow installing from PyPI…';
  mode.addEventListener('click', (event) => {
    event.preventDefault();
    if (ONLINE) { location.href = withTheme('./'); return; }
    const ok = confirm('The online terminal can download Python packages from PyPI (pypi.org), written by third parties.\n\n'
      + 'They run only inside that tab, on this tools site, separate from InkDOS: they cannot reach your InkDOS documents '
      + 'or your device, but they can read what you open in Python. Install only packages you trust.\n\nOpen the online terminal?');
    if (ok) location.href = withTheme('./online.html');
  });

  let lastName = '';
  function ready() {
    const term = globalThis.term, py = globalThis.pyodide;
    if (!term || !py || !py.FS) return setTimeout(ready, 200);
    keepFiles(py, term);
    bar.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    term.echo(safe(ONLINE
      ? 'InkDOS online terminal: import micropip, then await micropip.install("package-name") (pure-Python packages from PyPI).'
      : 'InkDOS: numpy, pandas, matplotlib, scipy, statsmodels, sympy, networkx, pillow, openpyxl, python-docx and more load on import.'));
    term.echo(safe('Open file… copies files into ' + HOME + '; Save file… downloads one (charts: plt.savefig("chart.png")). '
      + 'Files in ' + HOME + ' are kept in this browser\'s storage on this device, also after closing the tab.'));
    bar.querySelector('[data-open]').addEventListener('click', () => picker.click());
    picker.addEventListener('change', async () => {
      for (const file of picker.files) {
        const name = file.name.replace(/[\\/]/g, '_');
        try {
          py.FS.writeFile(HOME + '/' + name, new Uint8Array(await file.arrayBuffer()));
          lastName = name;
          term.echo(safe('Opened ' + name + ' → ' + HOME + '/' + name));
          store();
        } catch (error) { term.error(safe('Could not open ' + name + ': ' + error)); }
      }
      picker.value = '';
    });
    bar.querySelector('[data-save]').addEventListener('click', () => {
      const path = prompt('File to save (a path in Python, e.g. result.xlsx):', lastName);
      if (!path) return;
      const full = path.startsWith('/') ? path : py.FS.cwd().replace(/\/$/, '') + '/' + path;
      try {
        const data = py.FS.readFile(full);
        const url = URL.createObjectURL(new Blob([data]));
        const link = doc.createElement('a');
        link.href = url; link.download = full.split('/').pop();
        doc.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        term.echo(safe('Saved ' + full));
      } catch (error) { term.error(safe('Could not save ' + full + ': no such file')); }
    });
  }
  // Files in HOME persist in the browser's own storage (IndexedDB, through Emscripten's IDBFS): restored when the
  // terminal opens and written back a few seconds after a change, when the tab is hidden and before it closes.
  let store = () => {};
  function keepFiles(py, term) {
    try {
      py.FS.mount(py.FS.filesystems.IDBFS, {}, HOME);
    } catch (error) { term.error(safe('Files will not be kept after closing (' + error + ')')); return; }
    let busy = false, again = false;
    const sync = () => {
      if (busy) { again = true; return; }
      busy = true;
      py.FS.syncfs(false, (error) => {
        busy = false;
        if (error) console.warn('InkDOS: could not keep the Python files', error);
        if (again) { again = false; sync(); }
      });
    };
    store = sync;
    py.FS.syncfs(true, (error) => {
      if (error) { term.error(safe('Could not restore the kept files: ' + error)); return; }
      const kept = py.FS.readdir(HOME).filter((n) => n !== '.' && n !== '..');
      if (kept.length) term.echo(safe('Kept files restored in ' + HOME + ': ' + kept.join(', ')));
      setInterval(sync, 5000);
    });
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') sync(); });
    addEventListener('pagehide', sync);
  }
  function install() { doc.body.appendChild(bar); doc.documentElement.classList.add('inkdos-python'); ready(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
