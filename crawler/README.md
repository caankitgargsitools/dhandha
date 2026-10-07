# Dhandha crawler

Dhandha's own tender crawler (no third-party tender data). It reads public tender listings on NIC GePNIC portals
(CPPP, Defence and most states) and GeM, opens each tender's public detail page for value / EMD / dates, and posts
them to Dhandha, which scores them for every company and records corrigenda and date extensions.

It never solves or bypasses captchas. Tender documents behind a captcha are downloaded later in the user's own
browser session by the Desktop Agent.

## Run on a server in India (cheapest option first)
1. Create a small Linux server in India, in this order of preference:
   - **Free:** Oracle Cloud "Always Free" Ampere A1 VM (up to 2 OCPU / 12 GB) with home region Mumbai or Hyderabad.
     Free capacity is sometimes unavailable; retry later or try the other region.
   - **Cheap:** AWS Lightsail Mumbai or DigitalOcean Bangalore, 2 CPU / 4 GB (about $24 a month).
   The image runs on both ARM (Oracle) and x86.
2. In Dhandha → Admin panel → Crawler, create an ingest key (shown once).
3. On the server:
   ```
   git clone https://github.com/caankitgargsitools/dhandha && cd dhandha/crawler
   cp .env.example .env   # paste the ingest key
   docker build -t dhandha-crawler .
   docker run -d --restart unless-stopped --env-file .env --name crawler dhandha-crawler
   docker logs -f crawler
   ```
4. Each run's counts appear in Admin panel → Crawler.

`npm test` checks the parsers. Portal layouts change: a source that returns no tenders is logged as
"NO TENDERS — check the site or adapter".
