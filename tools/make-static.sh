#!/bin/bash
# Build the whole free static website (Ninja Playground home + static projects) into dist/.
# Upload the contents of dist/ to Netlify, GitHub Pages, Cloudflare Pages, etc. See README.md.
set -e
cd "$(dirname "$0")/.."
node tools/build-site.js
echo; echo "Files:"; (cd dist && find . -type f | sort | sed 's|^\./|  |')
