// Dhandha crawler: every INTERVAL_HOURS, crawl each source and post tenders to Dhandha.
import { chromium } from "playwright";
import { GEPNIC, GEM } from "./sources.js";
import { crawlGepnic } from "./adapters/gepnic.js";
import { crawlGem } from "./adapters/gem.js";
import { sendTenders } from "./ingest.js";

const env = process.env;
for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "INGEST_KEY"]) if (!env[k]) { console.error(`Missing ${k}`); process.exit(1); }
const maxPages = Number(env.MAX_PAGES || 20);
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function runOnce() {
  const browser = await chromium.launch();
  try {
    for (const site of GEPNIC.filter((s) => !s.skip)) {
      try {
        const rows = await crawlGepnic(browser, site, { maxPages, log });
        const res = rows.length ? await sendTenders(site.portal, rows, env) : null;
        log(site.portal, rows.length ? res : "NO TENDERS — check the site or adapter");
      } catch (e) { log(site.portal, "FAILED", e.message); }
    }
    try {
      const rows = await crawlGem(browser, { maxPages, log, base: GEM.base });
      log("GeM", rows.length ? await sendTenders("GeM", rows, env) : "NO BIDS — check the adapter");
    } catch (e) { log("GeM FAILED", e.message); }
  } finally {
    await browser.close();
  }
}

if (process.argv.includes("--once")) await runOnce();
else {
  const hours = Number(env.INTERVAL_HOURS || 3);
  for (;;) {
    const t0 = Date.now();
    await runOnce();
    const wait = Math.max(5 * 60000, hours * 3600000 - (Date.now() - t0));
    log(`sleeping ${Math.round(wait / 60000)} min`);
    await new Promise((r) => setTimeout(r, wait));
  }
}
