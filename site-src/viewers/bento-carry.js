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
  // (handoff.html, InkDOS origin, answering only this origin) and is carried like an embedded hand-over; the
  // browser's Back returns to InkDOS.
  var INKDOS = 'https://vfydr2m9wk-ops.github.io', q = new URLSearchParams(location.search);
  var back = q.get('inkdos-return'), handoff = q.get('inkdos-handoff');
  if (back && back.indexOf(INKDOS + '/') === 0) { try { sessionStorage.setItem('inkdos-return', back); } catch (_) {} }
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

// InkDOS: on the toolkit pages InkDOS opens, a plain scrollbar always shown at the side (owner, 2026-10-10: in the XeOS
// desktop mode the page is scrolled with the mouse; WebKit otherwise hides the scrollbar until it scrolls)
(function () {
  'use strict';
  var fromInkdos = /[?&](embed=1|inkdos-return=)/.test(location.search);
  try { fromInkdos = fromInkdos || /^https:\/\/vfydr2m9wk-ops\.github\.io\//.test(sessionStorage.getItem('inkdos-return') || ''); } catch (_) {}
  if (!fromInkdos) return;
  var css = document.createElement('style');
  css.textContent = 'html{overflow-y:scroll}' +
    '::-webkit-scrollbar{width:12px;height:12px}::-webkit-scrollbar-track{background:rgba(127,127,127,.12)}' +
    '::-webkit-scrollbar-thumb{background:rgba(110,110,110,.55);border-radius:6px;border:2px solid transparent;background-clip:padding-box}';
  (document.head || document.documentElement).appendChild(css);
})();

// InkDOS: while a tool works, the loader shows a percentage, the current step and how long it has been running, so it
// never looks frozen; when the tool fails, the alert says so plainly (owner, 2026-10-10). Real percentages come from
// the tool when it reports them (its own bar, or "3 of 10" / "40%" in the text); otherwise an estimate that only grows.
(function () {
  'use strict';
  var pt = /^pt/i.test(navigator.language || document.documentElement.lang || '');
  var T = pt ? {
    step: 'Etapa', elapsed: 'em andamento h\u00e1', slow: 'Ainda trabalhando: arquivos grandes demoram mais. N\u00e3o feche a p\u00e1gina.',
    stuck: 'Est\u00e1 demorando muito. Se nada mudar, recarregue a p\u00e1gina e tente de novo.',
    failed: 'A opera\u00e7\u00e3o falhou. O arquivo original n\u00e3o foi alterado.', failTitle: 'Falhou',
    words: [[/engine|wasm|librar|download|initializ/i, 'Preparando o motor (mais lento s\u00f3 na primeira vez)'], [/compress|condens|optimi/i, 'Comprimindo'],
      [/convert/i, 'Convertendo'], [/merg|combin/i, 'Juntando'], [/split|extract/i, 'Separando'], [/render|image|page/i, 'Processando p\u00e1ginas'],
      [/encrypt|protect/i, 'Protegendo com senha'], [/decrypt|unlock|remov/i, 'Removendo a senha'], [/sav|generat|creat|writ|zip/i, 'Gerando o arquivo'],
      [/load|read|pars|open/i, 'Lendo o arquivo'], [/./, 'Processando']]
  } : {
    step: 'Step', elapsed: 'running for', slow: 'Still working: large files take longer. Keep this page open.',
    stuck: 'This is taking very long. If nothing changes, reload the page and try again.',
    failed: 'The operation failed. The original file was not changed.', failTitle: 'Failed', words: null
  };
  var BAD = /error|fail|invalid|could ?n.t|unable|corrupt|erro|falh/i;
  var box, bar, pctText, info, active = false, start = 0, pct = 0, lastText = '', step = 0, changedAt = 0, crashed = null;
  function visible(el) { return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; }
  function describe(text) {
    if (!T.words) return text;
    for (var i = 0; i < T.words.length; i++) if (T.words[i][0].test(text)) return T.words[i][1];
    return text;
  }
  function build(modal) {
    var css = document.createElement('style');
    css.textContent = '#inkdos-progress{margin-top:14px;min-width:220px;text-align:center}' +
      '#inkdos-progress .ip-track{height:8px;border-radius:4px;background:rgba(127,127,127,.3);overflow:hidden}' +
      '#inkdos-progress .ip-bar{height:100%;width:0;background:#e0533f;transition:width .4s}' +
      '#inkdos-progress .ip-pct{font-weight:700;margin:6px 0 2px}#inkdos-progress .ip-info{font-size:13px;opacity:.8;line-height:1.35}';
    document.head.appendChild(css);
    box = document.createElement('div'); box.id = 'inkdos-progress'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<div class="ip-track"><div class="ip-bar"></div></div><div class="ip-pct">0%</div><div class="ip-info"></div>';
    bar = box.querySelector('.ip-bar'); pctText = box.querySelector('.ip-pct'); info = box.querySelector('.ip-info');
    var text = document.getElementById('loader-text');
    (text && text.parentNode || modal.firstElementChild || modal).appendChild(box);
  }
  function tick() {
    var modal = document.getElementById('loader-modal');
    if (!visible(modal)) {
      if (active) { active = false; if (crashed) failAlert(crashed); }
      return;
    }
    var now = Date.now(), textEl = document.getElementById('loader-text'), text = textEl ? textEl.textContent.trim() : '';
    if (!box || !modal.contains(box)) build(modal);
    if (!active) { active = true; start = changedAt = now; pct = 0; step = 0; lastText = ''; crashed = null; }
    if (text !== lastText) { lastText = text; step++; changedAt = now; pct = Math.min(95, pct + 3); }
    var native = modal.querySelector('.loader-progress-container'), known = null, m;
    if (native && !native.classList.contains('hidden')) {
      var nt = native.querySelector('.loader-progress-text'); m = nt && /(\d+)/.exec(nt.textContent); if (m) known = +m[1];
    } else if ((m = /(\d+)\s*(?:of|de|\/)\s*(\d+)/i.exec(text)) && +m[2] > 0) known = 100 * m[1] / m[2];
    else if ((m = /(\d+(?:\.\d+)?)\s*%/.exec(text))) known = +m[1];
    var secs = Math.round((now - start) / 1000);
    pct = known !== null ? Math.max(0, Math.min(100, known)) : Math.max(pct, 95 * (1 - Math.exp(-secs / 25)));
    box.querySelector('.ip-track').style.display = pctText.style.display = native && !native.classList.contains('hidden') ? 'none' : '';
    bar.style.width = pct.toFixed(1) + '%'; pctText.textContent = Math.floor(pct) + '%';
    var line = T.step + ' ' + step + ' \u00b7 ' + describe(text) + ' \u00b7 ' + T.elapsed + ' ' + (secs < 60 ? secs + ' s' : Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s');
    if (now - changedAt > 300000) line += '\n' + T.stuck; else if (secs > 20) line += '\n' + T.slow;
    info.style.whiteSpace = 'pre-line'; info.textContent = line;
    // a tool that threw and then sat still for 20 s with its loader open: close it and report the failure
    if (crashed && now - crashed.at > 20000 && changedAt < crashed.at) { modal.classList.add('hidden'); active = false; failAlert(crashed); }
  }
  function failAlert(err) {
    crashed = null;
    var modal = document.getElementById('alert-modal'), title = document.getElementById('alert-title'), msg = document.getElementById('alert-message');
    if (!modal || visible(modal)) return;
    if (title) title.textContent = T.failTitle;
    if (msg) msg.textContent = T.failed + (err.message ? '\n' + err.message : '');
    modal.classList.remove('hidden');
  }
  function onError(reason) { if (active && !crashed) crashed = { at: Date.now(), message: String(reason && (reason.message || reason) || '').slice(0, 300) }; }
  addEventListener('error', function (e) { onError(e.error || e.message); });
  addEventListener('unhandledrejection', function (e) { onError(e.reason); });
  // a failure alert from the tool itself gets the plain note on top
  new MutationObserver(function () {
    var modal = document.getElementById('alert-modal'), msg = document.getElementById('alert-message'), title = document.getElementById('alert-title');
    if (!visible(modal) || !msg || msg.dataset.inkdosNote === msg.textContent) return;
    if (BAD.test((title ? title.textContent : '') + ' ' + msg.textContent) && msg.textContent.indexOf(T.failed) < 0) {
      msg.style.whiteSpace = 'pre-line'; msg.textContent = T.failed + '\n' + msg.textContent;
    }
    msg.dataset.inkdosNote = msg.textContent;
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true, characterData: true });
  setInterval(tick, 300);
})();
