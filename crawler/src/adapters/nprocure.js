// Gujarat nProcure (tender.nprocure.com): the public home page lists every live tender (≈3,400) in a table that loads
// 10 at a time from the portal's own data call (beforeLoginTenderTableList). We open the page as a visitor, press
// "Next" like a person would and read each page's answer. No login and no captcha are involved (the login box's
// captcha is never touched).
import { industryPack, rupees } from "../classify.js";

export const NPROCURE = { portal: "Gujarat nProcure", base: "https://tender.nprocure.com", state: "Gujarat" };

const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// "13-11-2026 17:00:00" (India time) -> ISO
export function nprocureDate(s) {
  const m = String(s || "").match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const pad = (x) => String(x).padStart(2, "0");
  return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${m[5]}:00+05:30`;
}

// One answer of beforeLoginTenderTableList -> tender rows for ingest_tenders.
export function parseNprocure(json, site = NPROCURE) {
  const out = [];
  for (const r of json?.data || []) {
    const html = String(r["2"] || "");
    const id = (html.match(/Tender Id\s*:\s*(\d+)/i) || [])[1];
    const work = strip((html.match(/Name Of Work\s*:\s*(?:<[^>]+>)*([\s\S]*?)<\\?\/a>/i) || [])[1]);
    if (!id || !work) continue;
    const authority = strip((html.match(/<span[^>]*>([^<]+)<form/i) || [])[1]) || site.portal;
    const value = rupees((html.match(/Estimated Contract Value\s*:\s*([\d.,]+)/i) || [])[1]);
    const due = nprocureDate((html.match(/Last Date & Time For Submission\s*:\s*([\d\-: ]+)/i) || [])[1]);
    out.push({
      portal: site.portal, tender_ref: id, title: work.slice(0, 1000), authority, summary: strip(r["1"]) ? `Notice: ${strip(r["1"])}` : null,
      value_inr: value, due_at: due, state: site.state, industry_pack: industryPack(work), url: `${site.base}/`,
    });
  }
  return out;
}

export async function crawlNprocure(browser, { maxPages = 400, log = console.log, progress = () => {}, site = NPROCURE } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  const page = await ctx.newPage();
  const out = new Map();
  let total = null;
  const take = async (res) => {
    const j = await res.json().catch(() => null);
    if (!j) return 0;
    total = j.recordsFiltered ?? total;
    const rows = parseNprocure(j, site);
    for (const r of rows) out.set(r.tender_ref, r);
    return rows.length;
  };
  const isList = (r) => r.url().includes("beforeLoginTenderTableList");
  try {
    const first = page.waitForResponse(isList, { timeout: 60000 });
    await page.goto(`${site.base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await take(await first);
    const pages = Math.min(maxPages, Math.ceil((total || 10) / 10));
    for (let p = 2; p <= pages; p++) {
      progress({ phase: "listing", page: p, of: pages });
      // the table's own "Next" (href "#"), not the news slider's (href "#npPublicSlider")
      const next = await page.evaluateHandle(() => [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Next" && a.getAttribute("href") === "#" && !a.closest(".disabled")) || null);
      if (!next.asElement()) break;
      const resp = page.waitForResponse(isList, { timeout: 30000 }).catch(() => null);
      await next.asElement().click();
      const r = await resp;
      if (!r || !(await take(r))) break;
      await page.waitForTimeout(800); // polite pace
    }
    log(`  ${site.portal}: ${out.size} of ${total ?? "?"} tenders`);
  } finally {
    await ctx.close();
  }
  return [...out.values()];
}
