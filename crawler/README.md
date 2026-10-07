# Dhandha crawler

Dhandha's own tender crawler (no third-party tender data). It reads public tender listings on NIC GePNIC portals
(CPPP, Defence and most states) and GeM, opens each tender's public detail page for value / EMD / dates, and posts
them to Dhandha, which scores them for every company and records corrigenda and date extensions.

It never solves or bypasses captchas. Tender documents behind a captcha are downloaded later in the user's own
browser session by the Desktop Agent.

## Run on a server in India
1. Create a small Linux server in India (DigitalOcean Bangalore or AWS Lightsail Mumbai, 2 CPU / 4 GB to start).
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
