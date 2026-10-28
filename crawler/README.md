# Dhandha crawler

Dhandha's own tender crawler (no third-party tender data). It reads public tender listings on NIC GePNIC portals
(CPPP, Defence and most states) and GeM, opens each tender's public detail page for value / EMD / dates, and posts
them to Dhandha, which scores them for every company and records corrigenda and date extensions.

It also reads each GePNIC portal's public "Results of Tenders" (award of contract) pages and posts the winning
bidders to Dhandha (`ingest_awards`), where they become tender-winner leads. For GeM it reads the public result
view of finished bids and takes the L1 (or awarded) seller; `GEM_RESULT_STATUS` sets the listing filter it uses. Set `CRAWL_RESULTS=0` to turn this off.
If a results page asks for a captcha, the crawler shows the captcha picture in Admin → "Captcha needed" (bottom-right card on any admin page) and waits up to `CAPTCHA_WAIT_MIN` minutes (default 8; 0 = never ask) for a person to type it. Nobody answers → that portal's results are skipped and the rest of the run stops asking. Tender lists come from the public "Tenders by Closing Date" page, which has no captcha.

It never solves or bypasses captchas. Tender documents behind a captcha are downloaded later in the user's own
browser session by the Desktop Agent.

## Run on GitHub Actions (manual fallback)
`.github/workflows/crawler-run.yml` runs the crawler on demand only (Actions → crawler run → Run workflow): a
fallback while the server is down, a probe, or a debug run. It needs the repository secret `INGEST_KEY` (Admin →
Crawler → Create key). GitHub's machines are in the US, and GeM and some state portals refuse them, so the
scheduled crawl and the document worker run on the Indian server below. `tender-docs.yml` and `mca-monthly.yml`
are manual too, so two workers never claim the same document jobs or captcha sessions.

## Run on a server in India (AWS Mumbai)
GitHub Actions builds the crawler image for x86 and ARM on every change to `crawler/` on `main` and publishes
`ghcr.io/caankitgargsitools/dhandha-crawler:latest` (`.github/workflows/crawler-image.yml`).

1. Once: GitHub → your profile → Packages → `dhandha-crawler` → Package settings → Change visibility → Public
   (the image holds only crawler code, no keys). Otherwise the server would need a GitHub login to pull it.
2. Dhandha → Admin panel → Crawler → Create key. It shows a ready-made server setup script with the key inside.
3. AWS → EC2 → Launch instance in Mumbai (ap-south-1): Ubuntu 24.04 (arm64), t4g.small. Advanced details → User
   data → paste the script → Launch. It installs Docker and runs the crawler container (`src/server.js`: the
   crawler, the always-on document fetcher, MCA only with `MCA=1`) plus Watchtower, which checks for a new image
   every hour (`DOCKER_API_VERSION=1.44` for the current Docker engine).
4. Within about 10 minutes the first run shows under Admin → Crawler → Recent runs.

MCA refuses cloud machines (GitHub and AWS Mumbai both got 403), so its monthly file comes from the owner's own
computer (`tools/mca-upload.sh`) or an upload at Admin → New companies.

Any other Linux server works too: save the script as `setup.sh` and run `sudo bash setup.sh`.
Logs: `sudo docker logs -f crawler`.

`npm test` checks the parsers. Portal layouts change: a source that returns no tenders is logged as
"NO TENDERS — check the site or adapter".
