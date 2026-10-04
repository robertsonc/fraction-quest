#!/usr/bin/env python3
"""Builds the Cloudflare Pages package in public/ from the app sources in src/.

Output: index.html + app.css + app.js (split out of the single-file build so the page can run under a strict
Content-Security-Policy with no inline script), self-hosted fonts, web app manifest, icons, and an offline
service worker whose cache name is tied to the build hash so every deploy replaces the old cache.
"""
from __future__ import annotations

import hashlib
import logging
import re
import subprocess
import sys
from pathlib import Path

LOG = logging.getLogger("build_cf")
SRC = Path(__file__).resolve().parent / "src"
OUT = Path(__file__).resolve().parent / "public"
APP_PARTS = ["core.js", "st_a.js", "st_b.js", "st_c.js", "st_d.js"]
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


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def build() -> str:
    app_js = "".join(read(p) for p in APP_PARTS) + SW_REGISTER
    tmp = OUT.parent / ".check.js"
    tmp.write_text(app_js, encoding="utf-8")
    try:
        subprocess.run(["node", "--check", str(tmp)], check=True, timeout=60)
    finally:
        tmp.unlink(missing_ok=True)

    css = (OUT.parent / "fonts.css").read_text(encoding="utf-8") + read("style.css") + read("glass.css")
    body = read("body.html")
    body, n = re.subn(r'<linearGradient id="sheen".*?</linearGradient>', SHEEN, body, flags=re.S)
    if n != 1:
        raise RuntimeError(f"expected one tile sheen gradient in body.html, found {n}")
    if re.search(r'\son[a-z]+="', body):
        raise RuntimeError("inline event handler in body.html would be blocked by the CSP")

    version = hashlib.sha256((app_js + css + body).encode()).hexdigest()[:10]
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

    assets = ["./", f"./app.css?v={version}", f"./app.js?v={version}", "./manifest.webmanifest",
              "./fonts/lexend-latin.woff2", "./fonts/patrick-hand-latin.woff2",
              "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/favicon-64.png"]
    sw = (OUT.parent / "sw.template.js").read_text(encoding="utf-8")
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
