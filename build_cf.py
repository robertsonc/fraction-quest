#!/usr/bin/env python3
"""Builds the Cloudflare Pages package in public/ from the app sources in src/.

Output: index.html + app.css + app.js (split out of the single-file build so the page can run under a strict
Content-Security-Policy with no inline script), the printable tool pages under tools/, self-hosted fonts, web app
manifest, icons, and an offline service worker whose cache name is tied to the build hash so every deploy
replaces the old cache.
"""
from __future__ import annotations

import hashlib
import logging
import re
import subprocess
import sys
from pathlib import Path

LOG = logging.getLogger("build_cf")
ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "public"
APP_PARTS = ["core.js", "st_a.js", "st_b.js", "st_c.js", "st_d.js"]

# Printable tools: (slug, page title, one-line description). Each slug has a body fragment in src/tools/<slug>.html.
# Add a new sheet by dropping in a fragment and adding a row here; index.html is the list page.
TOOLS = [
    ("index", "Tools", "Printable one-page guides from Fraction Quest."),
    ("what-do-i-do", "Fractions: What Do I Do?", "Look at the sign, then add, subtract, multiply, or divide fractions."),
    ("factors-gcf-lcm", "How to Find Factors, GCF, and LCM", "Find factors, the greatest common factor, and the least common multiple."),
    ("simplified", "Is It Simplified All the Way?", "The check loop for simplifying a fraction completely."),
]

SHEEN = ('<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0" stop-color="#fff" stop-opacity=".62"/>'
         '<stop offset=".4" stop-color="#fff" stop-opacity=".12"/>'
         '<stop offset=".52" stop-color="#fff" stop-opacity="0"/>'
         '<stop offset="1" stop-color="#000" stop-opacity=".1"/>'
         '</linearGradient>')
SW_REGISTER = """
/* offline support: cache the app on first visit (secure contexts only: https, or localhost while testing) */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.debug('Offline cache unavailable:', err));
  });
}
"""
VINC = ('<span class="vinc" aria-hidden="true"><i style="--c:#E5483B"></i><i style="--c:#F38B2A"></i><i style="--c:#F2C12E"></i>'
        '<i style="--c:#3FAE68"></i><i style="--c:#20A4B5"></i><i style="--c:#3B7EE0"></i><i style="--c:#8E5AD5"></i></span>')
PRINT_ICON = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>'
              '<rect x="6" y="14" width="12" height="7"/></svg>')


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def check_js(code: str, label: str) -> None:
    tmp = ROOT / ".check.js"
    tmp.write_text(code, encoding="utf-8")
    try:
        subprocess.run(["node", "--check", str(tmp)], check=True, timeout=60)
    except subprocess.CalledProcessError as err:
        raise RuntimeError(f"{label} failed node --check") from err
    finally:
        tmp.unlink(missing_ok=True)


def check_no_inline_handlers(html: str, label: str) -> None:
    if re.search(r'\son[a-z]+="', html):
        raise RuntimeError(f"inline event handler in {label} would be blocked by the CSP")


def tool_page(slug: str, title: str, description: str, body: str, version: str) -> str:
    """Wraps a tool fragment in the shared shell: head, top bar (screen only), the sheet, print-only footer."""
    is_index = slug == "index"
    crumb = "" if is_index else '<span class="crumb"><a href="./">Tools</a><span aria-hidden="true">/</span><span>Sheet</span></span>'
    print_btn = "" if is_index else f'<button class="btn primary" type="button" data-print>{PRINT_ICON}Print</button>'
    sheet_open = '<main class="sheet-wrap">' if is_index else '<main><article class="sheet">'
    sheet_close = "</main>" if is_index else "</article></main>"
    page_title = "Fraction Quest Tools" if is_index else f"{title} | Fraction Quest Tools"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{page_title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#E6ECF7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A1021" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" href="../icons/favicon-64.png">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
<link rel="preload" href="../fonts/lexend-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="./tools.css?v={version}">
</head>
<body>
<div class="wrap">
  <nav class="bar no-print" aria-label="Site">
    <a class="brand" href="../" aria-label="Back to Fraction Quest"><span>Fraction</span>{VINC}<span>Quest</span></a>
    {crumb}
    <span class="actions">{print_btn}<a class="btn" href="../">Back to the app</a></span>
  </nav>
{sheet_open}
{body}
{sheet_close}
  <p class="print-foot">Fraction Quest &middot; fraction-quest-606.pages.dev/tools</p>
</div>
<script src="./tools.js?v={version}" defer></script>
</body>
</html>
"""


def build() -> str:
    app_js = "".join(read(p) for p in APP_PARTS) + SW_REGISTER
    check_js(app_js, "app.js")
    tools_js = read("tools/tools.js")
    check_js(tools_js, "tools.js")

    fonts = (ROOT / "fonts.css").read_text(encoding="utf-8")
    css = fonts + read("style.css") + read("glass.css")
    # tools.css lives one directory down, so the font URLs point back up to /fonts/.
    tools_css = fonts.replace("url('fonts/", "url('../fonts/") + read("tools/tools.css")

    body = read("body.html")
    body, n = re.subn(r'<linearGradient id="sheen".*?</linearGradient>', SHEEN, body, flags=re.S)
    if n != 1:
        raise RuntimeError(f"expected one tile sheen gradient in body.html, found {n}")
    check_no_inline_handlers(body, "body.html")

    tool_bodies = {slug: read(f"tools/{slug}.html") for slug, _, _ in TOOLS}
    for slug, frag in tool_bodies.items():
        check_no_inline_handlers(frag, f"tools/{slug}.html")

    version = hashlib.sha256(
        (app_js + css + body + tools_js + tools_css + "".join(tool_bodies.values())).encode()
    ).hexdigest()[:10]

    (OUT / "app.js").write_text(app_js, encoding="utf-8")
    (OUT / "app.css").write_text(css, encoding="utf-8")

    head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fraction Quest</title>
<meta name="description" content="Interactive practice for simplifying fractions, factoring, prime factor trees, mixed numbers, and story problems.">
<meta name="theme-color" content="#E6ECF7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A1021" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-title" content="Fractions">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" href="./icons/favicon-64.png">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="preload" href="./fonts/lexend-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="./app.css?v={version}">
</head>
<body>
"""
    (OUT / "index.html").write_text(head + body + f'<script src="./app.js?v={version}" defer></script>\n</body>\n</html>\n', encoding="utf-8")

    tools_out = OUT / "tools"
    tools_out.mkdir(exist_ok=True)
    (tools_out / "tools.css").write_text(tools_css, encoding="utf-8")
    (tools_out / "tools.js").write_text(tools_js, encoding="utf-8")
    for slug, title, description in TOOLS:
        (tools_out / f"{slug}.html").write_text(tool_page(slug, title, description, tool_bodies[slug], version), encoding="utf-8")

    # Pages serves tools/<slug>.html at the clean URL /tools/<slug> (and redirects the .html form to it).
    tool_urls = ["./tools/"] + [f"./tools/{slug}" for slug, _, _ in TOOLS if slug != "index"]
    assets = ["./", f"./app.css?v={version}", f"./app.js?v={version}", "./manifest.webmanifest",
              *tool_urls, f"./tools/tools.css?v={version}", f"./tools/tools.js?v={version}",
              "./fonts/lexend-latin.woff2", "./fonts/patrick-hand-latin.woff2",
              "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/favicon-64.png"]
    sw = (ROOT / "sw.template.js").read_text(encoding="utf-8")
    sw = sw.replace("__VERSION__", version).replace("__ASSETS__", ",\n  ".join(f"'{a}'" for a in assets))
    (OUT / "sw.js").write_text(sw, encoding="utf-8")
    return version


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        v = build()
    except (OSError, RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
        LOG.error("Build failed: %s", err)
        sys.exit(1)
    print(f"built public/ (version {v})")
