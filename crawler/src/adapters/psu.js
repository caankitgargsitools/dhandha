// PSU tender portals with their own systems (not GePNIC):
//  - NTPC (ntpctender.ntpc.co.in): "Live tenders" per region is a server-rendered table — S.No, NIT no, description,
//    location, bid submission date ("07 Nov 2026 3:00 PM"), days left, View tender. We open each region's page.
//  - SAIL (sailtenders.co.in): the home page loads its lists by data calls — tenders issued today and closing in three
//    days (JSON, wrapped in an outer array). Crawling every few hours collects each day's new tenders.
// Public pages only, no login, no captcha.
import { industryPack } from "../classify.js";

export const NTPC = { portal: "NTPC Tenders", base: "https://ntpctender.ntpc.co.in", authority: "NTPC Limited", regions: 12 };
export const SAIL = { portal: "SAIL Tenders", base: "https://sailtenders.co.in", authority: "Steel Authority of India Limited" };

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const istIso = (y, mo, d, h = 0, mi = 0) => new Date(Date.UTC(y, mo, d, h, mi) - 330 * 60000).toISOString();

// "07 Nov 2026 3:00 PM" / "Nov 14 2026  2:00:00:000PM" / "29 Oct 2026 12:55:00" → ISO (India time)
export function parseIstDate(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  let m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})(?: (\d{1,2}):(\d{2})(?::\d{2})?(?::\d{3})? ?([AP]M)?)?/i);
  let d, mo, y, h = 0, mi = 0, ap;
  if (m) [, d, mo, y, h = 0, mi = 0, ap] = m;
  else {
    m = t.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}) (\d{4})(?: (\d{1,2}):(\d{2})(?::\d{2})?(?::\d{3})? ?([AP]M)?)?/i);
    if (!m) return null;
    [, mo, d, y, h = 0, mi = 0, ap] = m;
  }
  const month = MON[String(mo).slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  let hour = Number(h);
  if (ap) hour = (hour % 12) + (/p/i.test(ap) ? 12 : 0);
  return istIso(Number(y), month, Number(d), hour, Number(mi));
}

const clean = (s) => String(s || "").replace(/\(opens in a new tab\)/gi, "").replace(/&amp;/g, "&").replace(/&#232;/g, "è").replace(/\s+/g, " ").trim();

// NTPC table rows (cells as text + the row's first link) → tenders
export function parseNtpcRows(rows, site = NTPC) {
  const out = [];
  for (const r of rows || []) {
    const cells = (r.cells || []).map(clean).filter(Boolean);
    const date = cells.find((c) => /^\d{1,2} [A-Za-z]{3} \d{4}/.test(c));
    const nit = cells.find((c) => /[\/-]/.test(c) && /\d/.test(c) && c.length <= 60 && !/^\d{1,2} [A-Za-z]{3}/.test(c) && !/days? left/i.test(c));
    if (!nit || !date) continue;
    const rest = cells.filter((c) => c !== nit && c !== date && !/^\d+$/.test(c) && !/days? left|^view tender/i.test(c));
    const title = rest.sort((a, b) => b.length - a.length)[0];
    if (!title) continue;
    const location = rest.find((c) => c !== title) || "";
    out.push({
      portal: site.portal, tender_ref: nit.slice(0, 120), title: `${title} (Ref ${nit})`.slice(0, 1000),
      authority: location ? `${site.authority} — ${location}` : site.authority, department: location || null,
      due_at: parseIstDate(date), industry_pack: industryPack(title), url: r.href || `${site.base}/Index/Etender`,
    });
  }
  return out;
}

// SAIL list answers ([[{TenderNo, nameofWork, BidSubmissionClosingDate, TenderopeningDate, procurementId, Circle_Division}]])
export function parseSail(answers, site = SAIL) {
  const seen = new Set(), out = [];
  for (const a of answers || []) {
    const list = Array.isArray(a) && Array.isArray(a[0]) ? a[0] : Array.isArray(a) ? a : [];
    for (const t of list) {
      const ref = clean(t.TenderNo), title = clean(t.nameofWork || t.nameofproject);
      const id = String(t.procurementId || ref);
      if (!ref || !title || seen.has(id)) continue;
      seen.add(id);
      const unit = clean(t.Circle_Division);
      out.push({
        portal: site.portal, tender_ref: id, title: `${title} (Ref ${ref})`.slice(0, 1000),
        authority: unit ? `${site.authority} — ${unit}` : site.authority, department: unit || null,
        due_at: parseIstDate(t.BidSubmissionClosingDate || t.TenderClosingDate), opening_at: parseIstDate(t.TenderopeningDate || t.TenderOpeningDate),
        industry_pack: industryPack(title), url: `${site.base}/Home/AdvancedSearch`,
      });
    }
  }
  return out;
}

export async function crawlNtpc(browser, { log = console.log, progress = () => {}, site = NTPC } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  const all = new Map();
  try {
    const page = await ctx.newPage();
    for (let reg = 1; reg <= site.regions; reg++) {
      progress({ phase: "listing", page: reg, of: site.regions });
      try {
        await page.goto(`${site.base}/Index/Search?Type=Reg&Region=${reg}`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2500);
        const rows = await page.$$eval("table tr", (trs) => trs.map((tr) => ({
          cells: [...tr.querySelectorAll("td")].map((td) => td.innerText),
          href: tr.querySelector("a[href]")?.href || null,
        })).filter((r) => r.cells.length >= 4));
        for (const t of parseNtpcRows(rows, site)) all.set(t.tender_ref, t);
      } catch (e) { log(`  ${site.portal} region ${reg}: ${e.message.split("\n")[0]}`); }
    }
  } finally { await ctx.close(); }
  log(`  ${site.portal}: ${all.size} live tenders`);
  return [...all.values()];
}

export async function crawlSail(browser, { log = console.log, progress = () => {}, site = SAIL } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  try {
    const page = await ctx.newPage();
    progress({ phase: "listing", page: 1, of: 1 });
    const want = (u) => /TenderlistIssuedToday|TenderlistCloasingInThreeDays|TenderlistClosingInThreeDays/i.test(u);
    const answers = [];
    page.on("response", async (r) => { if (want(r.url())) answers.push(await r.json().catch(() => null)); });
    await page.goto(`${site.base}/`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const rows = parseSail(answers.filter(Boolean), site);
    log(`  ${site.portal}: ${rows.length} tenders (issued today + closing in 3 days)`);
    return rows;
  } finally { await ctx.close(); }
}
