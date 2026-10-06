// Shared InkDOS viewer protocol, used when an InkDOS workspace embeds a viewer (?embed=1, same
// origin only):
//   viewer -> parent  {type:'inkdos-viewer-ready'}
//   parent -> viewer  {type:'inkdos-viewer-open', file: File}
//   viewer -> parent  {type:'inkdos-viewer-loaded', ok: true|false, error?: string}
// Each viewer page defines window.InkDOSViewer.open(file) -> Promise before this script runs.
(function () {
  'use strict';
  if (!/[?&]embed=1\b/.test(location.search) || window.parent === window) return;
  var parent = window.parent;
  function reply(message) { try { parent.postMessage(message, location.origin); } catch (_) {} }
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== parent) return;
    var data = event.data || {};
    if (data.type !== 'inkdos-viewer-open' || !(data.file instanceof Blob)) return;
    Promise.resolve()
      .then(function () { return window.InkDOSViewer.open(data.file); })
      .then(function () { reply({ type: 'inkdos-viewer-loaded', ok: true }); },
            function (error) { reply({ type: 'inkdos-viewer-loaded', ok: false, error: String(error && error.message || error) }); });
  });
  reply({ type: 'inkdos-viewer-ready' });
})();
