// InkDOS-tools, BentoPDF pages: "Edit PDF" in the InkDOS PDF workspace frames the toolkit (?embed=1) and hands it the
// PDF that is open there (viewer protocol, viewers/viewer-embed.js, loaded after this script). The PDF is kept for this
// frame (IndexedDB 'inkdos-bento-carry' and a flag in this frame's sessionStorage), so whichever tool is chosen next
// starts with it: its file input receives the PDF as if it had been picked.
(function () {
  'use strict';
  var FLAG = 'inkdos-bento-carry';
  function store(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(FLAG, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('files'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result, tx = db.transaction('files', mode), out = fn(tx.objectStore('files'));
        tx.oncomplete = function () { db.close(); resolve(out && out.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function give(file) {
    var start = function () {
      var tries = 0;
      (function poll() {
        var input = document.querySelector('#file-input');
        if (!input) { if (++tries < 60) setTimeout(poll, 100); return; }
        var transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })();
    };
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  }
  if (/[?&]embed=1\b/.test(location.search) && window.parent !== window) {
    window.InkDOSViewer = {
      open: function (file) {
        try { sessionStorage.setItem(FLAG, '1'); } catch (_) {}
        return store('readwrite', function (s) { s.put({ name: file.name, type: file.type, data: file }, 'current'); })
          .catch(function () {}).then(function () { give(file); });
      }
    };
    return;
  }
  // InkDOS inside another web page (XeOS on iPad): a framed toolkit does not scroll there, so InkDOS opens this page
  // on its own with ?inkdos-handoff=<id>&inkdos-return=<InkDOS page>. The PDF comes through a hidden InkDOS page
  // (handoff.html, InkDOS origin, answering only this origin) and is carried like an embedded hand-over; a small
  // button leads back to the InkDOS page on every toolkit page of this visit.
  var INKDOS = 'https://vfydr2m9wk-ops.github.io', q = new URLSearchParams(location.search);
  var back = q.get('inkdos-return'), handoff = q.get('inkdos-handoff');
  if (back && back.indexOf(INKDOS + '/') === 0) { try { sessionStorage.setItem('inkdos-return', back); } catch (_) {} }
  function backButton() {
    var url = null;
    try { url = sessionStorage.getItem('inkdos-return'); } catch (_) {}
    if (!url || url.indexOf(INKDOS + '/') !== 0 || document.getElementById('inkdosBack')) return;
    var b = document.createElement('a');
    b.id = 'inkdosBack'; b.href = url; b.textContent = '\u2190 InkDOS';
    b.setAttribute('aria-label', /^pt/i.test(navigator.language || '') ? 'Voltar ao InkDOS' : 'Back to InkDOS');
    b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 14px;border-radius:999px;' +
      'background:#192235;color:#fff;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
      'text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    document.body.appendChild(b);
  }
  if (document.body) backButton(); else document.addEventListener('DOMContentLoaded', backButton, { once: true });
  if (handoff && /^[A-Za-z0-9-]{8,64}$/.test(handoff)) {
    var frame = document.createElement('iframe');
    frame.hidden = true; frame.title = 'InkDOS';
    frame.src = INKDOS + '/InkDOS/handoff.html?id=' + encodeURIComponent(handoff);
    addEventListener('message', function (event) {
      var data = event.data || {};
      if (event.origin !== INKDOS || event.source !== frame.contentWindow || data.type !== 'inkdos-handoff-file' || !(data.file instanceof Blob)) return;
      var file = data.file instanceof File ? data.file : new File([data.file], String(data.name || 'document.pdf'), { type: 'application/pdf' });
      frame.remove();
      try { sessionStorage.setItem(FLAG, '1'); } catch (_) {}
      store('readwrite', function (s) { s.put({ name: file.name, type: file.type, data: file }, 'current'); })
        .catch(function () {}).then(function () { give(file); });
    });
    var attach = function () { document.body.appendChild(frame); };
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach, { once: true });
    return;
  }
  var carried = false;
  try { carried = sessionStorage.getItem(FLAG) === '1'; } catch (_) {}
  if (!carried || !window.indexedDB) return;
  store('readonly', function (s) { return s.get('current'); }).then(function (item) {
    if (item && item.data) give(new File([item.data], item.name || 'document.pdf', { type: item.type || 'application/pdf' }));
  }).catch(function () {});
})();
