// Dhandha crawler: crawl each source and post tenders and award results to Dhandha.
// Runs once (--once, used by GitHub Actions) or forever every INTERVAL_HOURS (server).
import { chromium } from "playwright";
import { GEPNIC, GEM } from "./sources.js";
import { crawlGepnic } from "./adapters/gepnic.js";
import { crawlGem } from "./adapters/gem.js";
import { crawlNprocure, NPROCURE } from "./adapters/nprocure.js";
import { crawlGepnicResults } from "./adapters/gepnicResults.js";
import { crawlGemResults } from "./adapters/gemResults.js";
import { sendTenders, sendAwards } from "./ingest.js";
import { createProgress, pool, rotate } from "./progress.js";
import { solveWithPerson } from "./captcha.js";

const env = process.env;
for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "INGEST_KEY"]) if (!env[k]) { console.error(`Missing ${k}`); process.exit(1); }
const maxPages = Number(env.MAX_PAGES || 20);
const maxAwards = Number(env.MAX_AWARDS || 300);
const maxDetails = Number(env.MAX_DETAILS || 40); // tender detail pages opened per portal per run
const concurrency = Number(env.CONCURRENCY || 2);
const budgetMs = Number(env.CRAWL_BUDGET_MIN || 0) * 60000; // 0 = no limit
// GePNIC results pages need a captcha; they are read in the admin's morning captcha session (docs.js winnersInSession),
// not in crawl runs where nobody is watching. CRAWL_RESULTS=1 brings the old crawl-time step back.
const results = env.CRAWL_RESULTS === "1";
const log = (...a) => console.log(new Date().toISOString(), ...a);
// a stray promise rejection (a page wait left behind by a failed step) is logged instead of ending the process
process.on("unhandledRejection", (e) => log("unhandled rejection:", e?.message || e));
// captcha pages wait for a person to type the answer in Admin → Crawler (CAPTCHA_WAIT_MIN, 0 = skip them)
// once a captcha goes unanswered nobody is watching, so the rest of this run skips captcha pages instead of waiting
let nobodyHome = false;
const captcha = (page, o) => !nobodyHome && solveWithPerson(page, env, { runner: env.RUNNER_NAME || "crawler", log, onMissed: () => { nobodyHome = true; }, ...o });

// One step per portal (its tenders, then its award results); GeM last.
function plan() {
  // ONLY_PORTALS="Punjab,Haryana" limits a run to matching portals (testing)
  const only = (env.ONLY_PORTALS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const pick = (name) => !only.length || only.some((o) => name.toLowerCase().includes(o));
  const sites = rotate(GEPNIC.filter((s) => !s.skip && pick(s.portal)), Math.floor(Date.now() / (8 * 3600000)));
  const steps = [], winners = [];
  for (const site of sites) {
    steps.push({ name: `${site.portal} · tenders`, run: (p) => crawlGepnic(p.browser, site, { maxDetails, log, progress: p.update }).then(async (rows) => ({ items: rows.length, note: rows.length ? summary(await sendTenders(site.portal, rows, env)) : "no tenders found — check the site or adapter" })) });
    if (results) winners.push({ name: `${site.portal} · winners`, run: (p) => crawlGepnicResults(p.browser, site, { maxPages: Math.min(maxPages, 10), maxAwards, log, progress: p.update, captcha }).then(async (rows) => ({ items: rows.length, note: rows.length ? summary(await sendAwards(`Results: ${site.portal}`, rows, env)) : "no results found — check the site or adapter" })) });
  }
  // state portals with their own systems (not GePNIC)
  if (pick(NPROCURE.portal)) steps.push({ name: `${NPROCURE.portal} · tenders`, run: (p) => crawlNprocure(p.browser, { maxPages: Number(env.NPROCURE_PAGES || 400), log, progress: p.update }).then(async (rows) => ({ items: rows.length, note: rows.length ? summary(await sendTenders(NPROCURE.portal, rows, env)) : "no tenders found — check the site or adapter" })) });
  // tenders everywhere first; winners pages wait for a person to type a captcha, so they go last
  if (!pick("GeM")) return [...steps, ...winners];
  steps.push({ name: "GeM · tenders", run: (p) => crawlGem(p.browser, { maxPages, log, base: GEM.base, progress: p.update }).then(async (rows) => ({ items: rows.length, note: rows.length ? summary(await sendTenders("GeM", rows, env)) : "no bids found — check the adapter" })) });
  if (env.CRAWL_RESULTS !== "0") winners.push({ name: "GeM · winners", run: (p) => crawlGemResults(p.browser, { maxPages: Math.min(maxPages, 5), maxBids: maxAwards, log, base: GEM.base, progress: p.update }).then(async (rows) => ({ items: rows.length, note: rows.length ? summary(await sendAwards("Results: GeM", rows, env)) : "no results found — check GEM_RESULT_STATUS or the adapter" })) });
  return [...steps, ...winners];
}

const summary = (r) => r ? Object.entries(r).map(([k, v]) => `${v} ${k}`).join(", ") : "";

async function runOnce() {
  nobodyHome = false;
  const steps = plan();
  const progress = createProgress(env, steps.map((s) => s.name), { log });
  const t0 = Date.now();
  await progress.start();
  const browser = await chromium.launch();
  let failed = 0;
  try {
    await pool(steps, concurrency, async (s) => {
      if (budgetMs && Date.now() - t0 > budgetMs) { progress.skip(s.name, "time budget used up — next run starts here"); return; }
      await progress.begin(s.name);
      try {
        const r = await s.run({ browser, update: (info) => progress.update(s.name, info) });
        log(s.name, r.note);
        await progress.end(s.name, r);
      } catch (e) {
        failed++;
        log(s.name, "FAILED", e.message);
        await progress.end(s.name, { error: e.message.slice(0, 300) });
      }
    });
  } finally {
    await browser.close();
    await progress.finish(failed < steps.length);
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
