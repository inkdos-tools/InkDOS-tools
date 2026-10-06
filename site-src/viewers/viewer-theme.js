// Shared by the InkDOS-tools viewers: follow the InkDOS appearance (light / dark / system, stored by
// InkDOS on this same origin) and mark embedded use (?embed=1), where an InkDOS workspace supplies
// the surrounding chrome.
(function () {
  'use strict';
  var root = document.documentElement, mode = 'system';
  try { mode = localStorage.getItem('inkdos2:appearance') || 'system'; } catch (_) {}
  if (!/^(light|dark|system)$/.test(mode)) mode = 'system';
  var dark = mode === 'dark' || (mode === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  if (/[?&]embed=1\b/.test(location.search)) root.dataset.embed = '1';
})();
