# Changelog

Changes to InkDOS-tools, newest first.

## 2026-10-09 · BentoPDF list inside InkDOS

- "Edit with BentoPDF" in the InkDOS PDF workspace frames the toolkit (`?embed=1`). There the start page shows no
  "PDF Tools" title, description, search bar or Popular Tools. The tools stay grouped by function, each on one
  line with its symbol on the right, and opening one group closes the others (`site-src/viewers/bento-list.js`).
- Opened on its own, outside the InkDOS frame, the page is unchanged.
- Fix: the search bar was still shown (it sits outside the title block); now hidden too. The button in InkDOS is
  now called "Edit PDF" ("Editar PDF").

