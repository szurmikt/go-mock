#!/usr/bin/env python3
"""
Build script: reads separate source files and produces a self-contained
index.html with all JS inlined as <script type="text/babel"> blocks.
Works when opened directly as a file:// URL (no local server needed).

Usage:
    python3 build.py
"""

import hashlib
import os

SCRIPT_ORDER = [
    "icons.js",
    "data.js",
    "login-screen.js",
    "property-screen.js",
    "home-screen.js",
    "arrivals-screen.js",
    "calendar-screen.js",
    "tasks-screen.js",
    "detail-screens.js",
    "tweaks-panel.jsx",
    "app.js",
]

here = os.path.dirname(os.path.abspath(__file__))

scripts_html = []
for filename in SCRIPT_ORDER:
    path = os.path.join(here, filename)
    with open(path, encoding="utf-8") as f:
        src = f.read()
    scripts_html.append(f'  <script type="text/babel">\n{src}\n  </script>')

scripts_block = "\n\n".join(scripts_html)

# Cache-bust styles.css: it's the one asset the browser might not re-fetch on
# a plain reload (unlike index.html itself, which is rewritten wholesale
# every build and so is never byte-identical to a cached copy). Without this,
# CSS-only edits can silently keep showing stale styles until a hard refresh.
with open(os.path.join(here, "styles.css"), "rb") as f:
    css_hash = hashlib.md5(f.read()).hexdigest()[:8]

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>SabeeApp Go</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css?v={css_hash}">
  <style>
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  </style>
</head>
<body>
  <div id="root"></div>

  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

{scripts_block}
</body>
</html>
"""

out = os.path.join(here, "index.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Built index.html ({len(html):,} bytes) from {len(SCRIPT_ORDER)} source files.")
