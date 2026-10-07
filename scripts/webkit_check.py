#!/usr/bin/env python3
"""Open the published tools site in WebKit (Safari's engine) with an iPad profile and report what happens:
console errors, page errors, failed requests and whether clicks on tools navigate. Diagnostics only."""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = 'https://inkdos-tools.github.io/InkDOS-tools/'
OUT = Path('webkit-report')


def watch(page, log: list[str]) -> None:
    page.on('console', lambda m: log.append(f'console.{m.type}: {m.text[:400]}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: log.append(f'pageerror: {str(e)[:400]}'))
    page.on('requestfailed', lambda r: log.append(f'requestfailed: {r.url[:200]} {r.failure}'))
    page.on('framenavigated', lambda f: log.append(f'navigated: {f.url}') if f == page.main_frame else None)


def main() -> int:
    OUT.mkdir(exist_ok=True)
    log: list[str] = []
    with sync_playwright() as pw:
        browser = pw.webkit.launch()
        context = browser.new_context(**pw.devices['iPad (gen 7) landscape'])
        page = context.new_page()
        watch(page, log)
        # PDF toolkit: start page, then a tool card
        log.append('== bentopdf start page')
        page.goto(SITE + 'bentopdf/?inkdos-theme=light', wait_until='load')
        page.wait_for_timeout(6000)
        log.append(f'url after load: {page.url}; crossOriginIsolated={page.evaluate("self.crossOriginIsolated")}; '
                   f'serviceWorker controller={page.evaluate("!!(navigator.serviceWorker && navigator.serviceWorker.controller)")}')
        cards = page.locator('a.tool-card')
        log.append(f'tool cards: {cards.count()}')
        page.screenshot(path=str(OUT / 'bentopdf-start.png'))
        for name in ('merge-pdf', 'word-to-pdf', 'pdf-to-docx'):
            link = page.locator(f'a.tool-card[href*="{name}"]').first
            log.append(f'== click {name}: href={link.get_attribute("href") if link.count() else None}')
            if not link.count():
                continue
            before = page.url
            link.scroll_into_view_if_needed()
            link.click()
            page.wait_for_timeout(5000)
            log.append(f'url before={before} after={page.url}')
            page.screenshot(path=str(OUT / f'after-{name}.png'))
            page.goto(SITE + 'bentopdf/', wait_until='load')
            page.wait_for_timeout(3000)
        # a tool page opened directly
        log.append('== direct word-to-pdf')
        page.goto(SITE + 'bentopdf/word-to-pdf.html', wait_until='load')
        page.wait_for_timeout(8000)
        log.append(f'url={page.url}; crossOriginIsolated={page.evaluate("self.crossOriginIsolated")}; '
                   f'file input={page.locator("#file-input").count()}')
        page.screenshot(path=str(OUT / 'word-to-pdf.png'))
        browser.close()
    text = '\n'.join(log)
    (OUT / 'report.txt').write_text(text + '\n', encoding='utf-8')
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
