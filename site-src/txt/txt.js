// InkDOS Plain Text: CodeMirror 5 (the editor) with Open, Save and New. Files stay on this device: Open reads a file
// picked here, Save downloads it again under its name.
(function () {
  'use strict';
  var MODES = { md: 'markdown', markdown: 'markdown', json: 'application/json', jsonl: 'application/json', ndjson: 'application/json',
    js: 'javascript', xml: 'xml', html: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml', css: 'css', py: 'python', sh: 'shell',
    ini: 'properties', cfg: 'properties', conf: 'properties', properties: 'properties', toml: 'toml' };
  var name = 'untitled.txt', saved = '';
  var label = document.getElementById('name'), input = document.getElementById('file-input');
  var editor = CodeMirror(document.getElementById('editor'), {
    lineNumbers: true, lineWrapping: true, matchBrackets: true, indentUnit: 2, tabSize: 4, autofocus: true,
    inputStyle: 'contenteditable', spellcheck: true, autocorrect: true, autocapitalize: true
  });
  function dirty() { return editor.getValue() !== saved; }
  function show() { label.textContent = (dirty() ? '• ' : '') + name; document.title = name + ' · Plain Text'; }
  function load(text, fileName) {
    name = fileName; saved = text;
    editor.setOption('mode', MODES[(fileName.split('.').pop() || '').toLowerCase()] || null);
    editor.setValue(text); editor.clearHistory(); editor.focus(); show();
  }
  editor.on('change', show);
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file || (dirty() && !confirm('Discard the unsaved changes?'))) return;
    file.text().then(function (text) { load(text, file.name); });
    input.value = '';
  });
  document.querySelector('[data-open]').addEventListener('click', function () { input.click(); });
  document.querySelector('[data-new]').addEventListener('click', function () {
    if (!dirty() || confirm('Discard the unsaved changes?')) load('', 'untitled.txt');
  });
  document.querySelector('[data-save]').addEventListener('click', function () {
    var text = editor.getValue(), url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    saved = text; show();
  });
  document.querySelector('[data-find]').addEventListener('click', function () { editor.execCommand('find'); });
  document.querySelector('[data-wrap]').addEventListener('change', function (e) { editor.setOption('lineWrapping', e.target.checked); });
  addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
  show();
})();
