// OpenDocument viewer: WebODF (odf.OdfCanvas) renders .odt/.ods/.odp read-only. Standalone it
// opens a picked file; embedded (?embed=1) an InkDOS workspace hands the file over with the
// shared viewer protocol (see ../viewers/viewer-embed.js).
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var element = document.getElementById('odf');
  var status = document.getElementById('status');
  var canvas = null, url = null;

  function fit() {
    if (!canvas || element.hidden) return;
    try { canvas.fitToWidth(Math.max(320, stage.clientWidth - 48)); } catch (_) {}
  }

  function show(file) {
    return new Promise(function (resolve, reject) {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(file);
      document.getElementById('fileName').textContent = file.name || '';
      status.textContent = 'Opening ' + (file.name || 'document') + '…';
      status.hidden = false;
      element.hidden = true;
      if (!canvas) canvas = new odf.OdfCanvas(element);
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        status.textContent = 'This file could not be shown.';
        reject(new Error('timeout'));
      }, 30000);
      canvas.addListener('statereadychange', function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        status.hidden = true;
        element.hidden = false;
        fit();
        resolve();
      });
      canvas.load(url);
    });
  }

  document.getElementById('picker').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (file) show(file).catch(function () {});
  });
  window.addEventListener('resize', fit);
  window.InkDOSViewer = { open: show };
})();
