# Changelog

Changes to InkDOS-tools, newest first.

## 2026-10-10 · Plain scrollbar

- The Up / Down buttons and the "← InkDOS" button are gone from the toolkit pages InkDOS opens; they show a plain
  scrollbar at the side instead, always visible (XeOS desktop mode is used with a mouse). Owner request.

## 2026-10-10 · BentoPDF start page back to the original

- The one-line grouped tool list (viewers/bento-list.js) is no longer added: BentoPDF shows its original start page
  again, with the search bar and its own tool layout (owner). InkDOS opens it as a page of its own.

## 2026-10-10 · Up / Down side bar

- Toolkit pages opened from InkDOS (framed or as their own page) get a side bar with Up and Down buttons, so the
  page moves with a tap where swiping does not scroll it (XeOS on iPad). Owner request.

## 2026-10-10 · BentoPDF as a separate page (InkDOS in XeOS)

- Inside the XeOS web desktop a framed toolkit does not scroll, so InkDOS opens BentoPDF as a page of its own
  (?inkdos-handoff=<id>&inkdos-return=<InkDOS page>). bento-carry.js fetches the PDF through a hidden InkDOS page
  (handoff.html) and carries it like an embedded hand-over; a "← InkDOS" button leads back on every toolkit page
  of that visit, and bento-list.js keeps the InkDOS list layout. CSP frame-src allows the InkDOS origin.

## 2026-10-09 · BentoPDF list inside InkDOS

- "Edit with BentoPDF" in the InkDOS PDF workspace frames the toolkit (`?embed=1`). There the start page shows no
  "PDF Tools" title, description, search bar or Popular Tools. The tools stay grouped by function, each on one
  line with its symbol on the right, and opening one group closes the others (`site-src/viewers/bento-list.js`).
- Opened on its own, outside the InkDOS frame, the page is unchanged.
- Fix: the search bar was still shown (it sits outside the title block); now hidden too. The button in InkDOS is
  now called "Edit PDF" ("Editar PDF").

