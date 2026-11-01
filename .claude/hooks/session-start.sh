#!/bin/bash
# Cloud sessions: install the app's and the crawler's packages so tests and the build work straight away.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund --loglevel=error
# the crawler's Playwright uses the browser already in the image; never download another
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix crawler --no-audit --no-fund --loglevel=error
