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

## Run on GitHub Actions (no server)
`.github/workflows/crawler-run.yml` runs the crawler three times a day and on demand (Actions → crawler run →
Run workflow). It needs the repository secret `INGEST_KEY` (Admin → Crawler → Create key). Each run starts new
portals for 17 minutes, three at a time, and the starting portal rotates so all are covered over the day.
Progress shows live in Admin → Crawler. GitHub's machines are in the US; any state portal that refuses them can
be crawled from an Indian server instead.

## Run on a server in India (free: Oracle Cloud Always Free, Mumbai)
GitHub Actions builds the crawler image for x86 and ARM on every change to `crawler/` on `main` and publishes
`ghcr.io/caankitgargsitools/dhandha-crawler:latest` (`.github/workflows/crawler-image.yml`).

1. Once: GitHub → your profile → Packages → `dhandha-crawler` → Package settings → Change visibility → Public
   (the image holds only crawler code, no keys). Otherwise the server would need a GitHub login to pull it.
2. Dhandha → Admin panel → Crawler → Create key. It shows a ready-made server setup script with the key inside.
3. Oracle Cloud → Compute → Create instance: Mumbai or Hyderabad. Choose the shape first: Ampere →
   VM.Standard.A1.Flex (2 OCPU / 12 GB is within Always Free), then the image Oracle Linux 9 (Ubuntu works
   too when Oracle offers an ARM build of it). Advanced options → Initialization script → paste the script → Create.
   Free capacity is sometimes unavailable; retry later or try the other region.
4. Within about 10 minutes the first run shows under Admin → Crawler → Recent runs. Watchtower on the server
   updates the crawler by itself whenever a new image is published.

Any other Linux server works too: save the script as `setup.sh` and run `sudo bash setup.sh`.
Logs: `sudo docker logs -f crawler`.

`npm test` checks the parsers. Portal layouts change: a source that returns no tenders is logged as
"NO TENDERS — check the site or adapter".
