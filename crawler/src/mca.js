// MCA monthly file fetcher: opens MCA's "companies and LLPs incorporated during the month" page like a normal visitor,
// finds the monthly spreadsheets of the last six months, and loads it into Dhandha's New companies (ingest_mca) — the same file the
// admin used to upload by hand. A file already loaded is skipped. Where MCA's site answers with a bot check or a
// captcha, nothing is attempted: the run reports it and the admin gets a phone alert to upload by hand.
//   node src/mca.js            check once (GitHub Actions runs it daily: .github/workflows/mca-monthly.yml)
import { chromium } from "playwright";
import { readXlsx } from "../../lib/xlsx.js";
import { mcaFromRows } from "../../lib/mca.js";
import { unzip } from "./unzip.js";
import { pickRecent, looksBlocked } from "./mcaPick.js";

const env = process.env;
for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "INGEST_KEY"]) if (!env[k]) { console.error(`Missing ${k}`); process.exit(1); }
const log = (...a) => console.log(new Date().toISOString(), ...a);
const RUNNER = env.RUNNER_NAME || "mca";
const MONTHS = Number(env.MCA_MONTHS || 6); // the last six monthly files; ones already loaded are skipped
const PAGES = (env.MCA_PAGES || [
  "https://www.mca.gov.in/content/mca/global/en/data-and-reports/company-llp-info/incorporated-closed-month.html",
  "https://www.mca.gov.in/content/mca/global/en/data-and-reports/company-statistics.html",
].join(",")).split(",").map((s) => s.trim()).filter(Boolean);

async function rpc(fn, body) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_key: env.INGEST_KEY, ...body }),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const report = (o) => rpc("mca_fetch_report", { p_name: o.name || null, p_url: o.url || null, p_status: o.status, p_rows: o.rows ?? null, p_inserted: o.inserted ?? null, p_updated: o.updated ?? null, p_detail: o.detail || null, p_runner: RUNNER });

// spreadsheet bytes → rows (a zip may hold the spreadsheet)
function rowsOf(name, data) {
  if (/\.zip$/i.test(name) || data.subarray(0, 2).toString() === "PK" && !/\.xlsx$/i.test(name)) {
    const inner = unzip(data).find((f) => /\.(xlsx|csv)$/i.test(f.name));
    if (!inner) throw new Error("the zip holds no .xlsx or .csv");
    return rowsOf(inner.name, inner.data);
  }
  if (/\.xlsx$/i.test(name) || data.subarray(0, 2).toString() === "PK") return readXlsx(data, { maxRows: 100000 });
  if (/\.csv$/i.test(name)) {
    const lines = data.toString("utf8").split(/\r?\n/).filter(Boolean);
    const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    return lines.map(split);
  }
  throw new Error("old .xls format — open it in Excel, save as .xlsx and upload at Admin → New companies");
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ locale: "en-IN", acceptDownloads: true });
  const page = await ctx.newPage();
  let files = [], seenPage = null;
  for (const url of PAGES) {
    log("open", url);
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => ({ error: e }));
    if (res?.error) { log("  ", res.error.message.split("\n")[0]); continue; }
    await page.waitForTimeout(3000);
    const html = await page.content();
    if (looksBlocked(res.status(), html)) { await report({ status: "blocked", url, detail: `MCA answered ${res.status()} with a bot check` }); process.exit(0); }
    seenPage = url;
    const links = await page.$$eval("a[href]", (as) => as.map((a) => ({ href: a.href, text: a.innerText.trim().slice(0, 200) })));
    files = pickRecent(links, MONTHS);
    log(`  ${links.length} links; monthly files: ${files.map((f) => f.month).join(", ") || "none"}`);
    if (files.length) break;
  }
  if (!files.length) {
    await report({ status: seenPage ? "no_file" : "failed", url: seenPage || PAGES[0], detail: seenPage ? "the page opened but no monthly file link was found" : "MCA's pages did not open" });
    process.exit(0);
  }
  for (const found of files) {
    const name = decodeURIComponent(found.href.split("/").pop().split("?")[0]).slice(0, 200);
    if (await rpc("mca_fetch_seen", { p_name: name })) { log("already loaded:", name); continue; }
    const resp = await ctx.request.get(found.href, { timeout: 120000 });
    const body = Buffer.from(await resp.body());
    const type = resp.headers()["content-type"] || "";
    if (!resp.ok() || /text\/html/i.test(type)) {
      const blocked = looksBlocked(resp.status(), body.toString("utf8", 0, 5000));
      await report({ status: blocked ? "blocked" : "failed", name, url: found.href, detail: `download answered ${resp.status()} ${type}` });
      if (blocked) break;
      continue;
    }
    let rows;
    try { rows = rowsOf(name, body); } catch (e) { await report({ status: "failed", name, url: found.href, detail: e.message }); continue; }
    const { companies, skipped, error } = mcaFromRows(rows);
    if (error || !companies.length) { await report({ status: "failed", name, url: found.href, rows: rows.length, detail: error || `no rows with a valid CIN/LLPIN (${skipped} skipped)` }); continue; }
    const t = { inserted: 0, updated: 0 };
    for (let i = 0; i < companies.length; i += 2000) {
      const r = await rpc("ingest_mca", { p_source: `MCA ${name}`.slice(0, 60), p_rows: companies.slice(i, i + 2000) });
      t.inserted += r?.inserted || 0; t.updated += r?.updated || 0;
    }
    log(`loaded ${name}: ${t.inserted} new, ${t.updated} updated, ${skipped} skipped`);
    await report({ status: "loaded", name, url: found.href, rows: companies.length, inserted: t.inserted, updated: t.updated, detail: skipped ? `${skipped} rows without a valid CIN skipped` : null });
  }
} catch (e) {
  log("failed:", e.message);
  await report({ status: "failed", detail: e.message.split("\n")[0] }).catch(() => {});
} finally {
  await browser.close();
}
