// InkDOS-tools, BentoPDF tool list inside the InkDOS PDF workspace ("Edit with BentoPDF" frames it with ?embed=1).
// Owner's layout: no "PDF Tools" title, description, search bar or Popular Tools; the tools stay grouped by function,
// each listed on one line with its symbol on the right, and opening one group closes the others. Outside the InkDOS
// frame the page is left as it is.
(function () {
  'use strict';
  if (!/[?&]embed=1/.test(location.search) || !/\/bentopdf\/(index\.html)?$/.test(location.pathname)) return;
  var css = document.createElement('style');
  css.textContent = [
    '#tools-header{display:none!important}',
    // the search bar (and its shortcut keys) sits in the first block of #grid-view, above the list
    '#grid-view>div:has(#search-bar){display:none!important}',
    '#tool-grid{display:block!important}',
    '#tool-grid .category-group{margin:0 0 10px;border:1px solid rgba(127,127,127,.25);border-radius:12px;overflow:hidden}',
    '#tool-grid .category-header{width:100%;padding:12px 14px}',
    '#tool-grid .category-tools{display:flex!important;flex-direction:column;gap:0!important}',
    '#tool-grid .tool-card{flex-direction:row-reverse!important;justify-content:space-between!important;align-items:center!important;',
    'text-align:left!important;padding:10px 14px!important;border-radius:0!important;box-shadow:none!important;',
    'border-top:1px solid rgba(127,127,127,.18)!important;min-height:0!important;gap:12px}',
    '#tool-grid .tool-card i{font-size:22px!important;margin:0!important;flex:0 0 auto}',
    '#tool-grid .tool-card h3{font-size:14px;font-weight:600}',
    '#tool-grid .tool-card p{display:none!important}'
  ].join('');
  (document.head || document.documentElement).appendChild(css);

  function header(group) { return group.querySelector('.category-header'); }
  function title(group) { var h = header(group); return h ? h.textContent.trim() : ''; }
  function open(group) { return !group.classList.contains('collapsed'); }

  function arrange(grid) {
    var groups = Array.prototype.slice.call(grid.querySelectorAll('.category-group'));
    if (!groups.length || grid.dataset.inkdosList) return !!groups.length;
    grid.dataset.inkdosList = '1';
    // Popular Tools repeats tools listed in their own groups: hidden (the first group, or the one so named)
    groups.forEach(function (group, i) {
      if (i === 0 || /popular|populares/i.test(title(group))) group.style.display = 'none';
    });
    var shown = groups.filter(function (group) { return group.style.display !== 'none'; });
    // all groups start closed
    shown.forEach(function (group) { if (open(group) && header(group)) header(group).click(); });
    // opening one closes the others
    shown.forEach(function (group) {
      var h = header(group);
      if (!h) return;
      h.addEventListener('click', function () {
        setTimeout(function () {
          if (!open(group)) return;
          shown.forEach(function (other) { if (other !== group && open(other) && header(other)) header(other).click(); });
        }, 0);
      });
    });
    return true;
  }

  // the toolkit renders its groups after load: arrange them once the list has stopped changing for a moment
  function start() {
    var timer = 0;
    var watch = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var g = document.getElementById('tool-grid');
        if (g && g.querySelector('.category-group') && arrange(g)) watch.disconnect();
      }, 300);
    });
    watch.observe(document.documentElement, { childList: true, subtree: true });
    var g = document.getElementById('tool-grid');
    if (g && g.querySelector('.category-group')) timer = setTimeout(function () { if (arrange(g)) watch.disconnect(); }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
