// Loaded first by tools that have their own light/dark setting (IT-Tools, CyberChef): follow the
// InkDOS appearance (stored by InkDOS on this same origin) so a tool opened from InkDOS matches it.
// Each tool keeps its own setting; this only writes it before the tool starts.
(function () {
  'use strict';
  var mode = 'system';
  try { mode = localStorage.getItem('inkdos2:appearance') || 'system'; } catch (_) { return; }
  if (!/^(light|dark|system)$/.test(mode)) mode = 'system';
  var dark = mode === 'dark' || (mode === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  var tool = document.currentScript && document.currentScript.dataset.tool;
  try {
    if (tool === 'it-tools') {
      // @vueuse/core useDark() storage: 'light' | 'dark' | 'auto'
      localStorage.setItem('vueuse-color-scheme', mode === 'system' ? 'auto' : mode);
    } else if (tool === 'cyberchef') {
      // CyberChef merges localStorage.options over its defaults (src/web/App.mjs)
      var options = {};
      try { options = JSON.parse(localStorage.getItem('options') || '{}') || {}; } catch (_) { options = {}; }
      options.theme = dark ? 'dark' : 'classic';
      localStorage.setItem('options', JSON.stringify(options));
    }
  } catch (_) {}
})();
