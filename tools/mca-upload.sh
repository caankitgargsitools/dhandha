#!/bin/bash
# Dhandha — MCA monthly files from your own computer (Mac or Linux).
# Opens MCA's "incorporated during the month" page in your own Chrome, downloads the last six monthly files of newly
# registered companies and LLPs, and loads them into Dhandha (Admin → New companies). Files already loaded are skipped.
# If MCA shows a check or captcha, you complete it yourself in the Chrome window; nothing here solves it.
# Needs: Google Chrome and Node.js 18+ (https://nodejs.org). Run:
#   bash <(curl -fsSL https://raw.githubusercontent.com/caankitgargsitools/dhandha/main/tools/mca-upload.sh)
set -e
REPO="https://raw.githubusercontent.com/caankitgargsitools/dhandha/main"
DIR="$HOME/dhandha-mca"
command -v node >/dev/null || { echo "Please install Node.js first: https://nodejs.org (the LTS button), then run this again."; exit 1; }
mkdir -p "$DIR/crawler/src" "$DIR/lib"
cd "$DIR"
echo "Getting the latest Dhandha MCA files…"
for f in crawler/src/mca.js crawler/src/mcaPick.js crawler/src/unzip.js lib/xlsx.js lib/mca.js; do
  curl -fsSL -H "Cache-Control: no-cache" "$REPO/$f?v=$(date +%s)" -o "$f"   # always the newest version
done
echo '{"type":"module"}' > lib/package.json
cat > crawler/package.json <<'PKG'
{ "name": "dhandha-mca", "private": true, "type": "module", "dependencies": { "playwright-core": "1.56.1" } }
PKG
( cd crawler && npm install --silent --no-audit --no-fund )
KEYFILE="$DIR/.key"
# a key looks like dhk_ followed by letters and digits; an old or wrong saved value is asked for again
valid() { printf '%s' "$1" | grep -Eq '^dhk_[A-Za-z0-9]{16,}$'; }
if [ -s "$KEYFILE" ] && ! valid "$(cat "$KEYFILE")"; then rm -f "$KEYFILE"; fi
if [ ! -s "$KEYFILE" ]; then
  echo
  echo "Paste the Dhandha upload key (Admin → Crawler → Create key, name it 'MCA laptop'), then press Enter."
  echo "Only the key: the line after INGEST_KEY= (it starts with dhk_). Nothing shows while you paste."
  echo "It is saved only on this computer, in $KEYFILE."
  IFS= read -r -s KEY
  # a pasted block of several lines is read to the end here, so none of it reaches the shell afterwards
  while IFS= read -r -s -t 1 MORE; do KEY="$KEY $MORE"; done
  echo
  # if the whole setup script was pasted, keep only the key
  KEY="$(printf '%s' "$KEY" | grep -Eo 'dhk_[A-Za-z0-9]{16,}' | head -n1)"
  valid "$KEY" || { echo "That did not look like a key (it starts with dhk_). Run this again and paste only the key."; exit 1; }
  umask 077; printf '%s' "$KEY" > "$KEYFILE"
fi
export SUPABASE_URL="https://umyesrpibsdgzsrqfvqf.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="sb_publishable_b1_jKTEARE2OINvUDaM62g_Q5JxoB6w"
export INGEST_KEY="$(cat "$KEYFILE")"
export MCA_VISIBLE=1 RUNNER_NAME="mca-laptop" TZ="Asia/Kolkata"
echo "Opening MCA in Chrome… (leave the window open until this finishes)"
cd crawler && node src/mca.js
echo "Done. See Admin → New companies in Dhandha; your phone also gets an alert."
