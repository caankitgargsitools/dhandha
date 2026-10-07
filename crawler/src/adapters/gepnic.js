// NIC GePNIC portals (CPPP, Defence and most states). Reads "Latest Active Tenders",
// opens each tender's detail page for value / EMD / pre-bid, never touches captcha-protected downloads.
import { parseIstDate, rupees, industryPack, stateFrom } from "../classify.js";

const LIST = "?page=FrontEndLatestActiveTenders&service=page";

export function parseTitleCell(text) {
  // "[Title of work] [Ref No][2026_HRY_412871_1]" — the last bracket is the tender ID
  const parts = [...String(text).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim());
  if (parts.length >= 2) return { title: parts[0], ref: parts.at(-2), tenderId: parts.at(-1) };
  return { title: String(text).trim(), ref: null, tenderId: null };
}

export function parseDetail(rows) {
  // rows: [[label, value, label, value], ...] from the detail page tables
  const map = {};
  for (const r of rows) for (let i = 0; i + 1 < r.length; i += 2) map[r[i].replace(/\s+/g, " ").trim().toLowerCase()] = r[i + 1].trim();
  const get = (...keys) => { for (const k of keys) for (const [mk, v] of Object.entries(map)) if (mk.startsWith(k)) return v; return null; };
  return {
    value_inr: rupees(get("tender value in", "tender value")),
    emd_inr: rupees(get("emd amount in", "emd amount")),
    fee_inr: rupees(get("tender fee in", "tender fee")),
    prebid_on: parseIstDate(get("pre bid meeting date"))?.slice(0, 10) || null,
    opening_at: parseIstDate(get("bid opening date")),
    due_at: parseIstDate(get("bid submission end date")),
    location: get("location"),
    category: get("tender category", "product category"),
  };
}

export async function crawlGepnic(browser, site, { maxPages = 20, log = console.log } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN", userAgent: "Mozilla/5.0 (DhandhaBot; tender alerts for registered businesses)" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(site.base + LIST, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let p = 0; p < maxPages; p++) {
      const rows = await page.$$eval("table.list_table tr, table#table tr", (trs) =>
        trs.map((tr) => {
          const tds = [...tr.querySelectorAll("td")];
          const a = tr.querySelector("td a");
          return { cells: tds.map((td) => td.innerText.trim()), href: a ? a.getAttribute("href") : null };
        }).filter((r) => r.cells.length >= 6 && /^\d+\.?$/.test(r.cells[0])));
      for (const r of rows) {
        const { title, ref, tenderId } = parseTitleCell(r.cells[4]);
        if (!tenderId) continue;
        const org = r.cells[5];
        out.push({
          portal: site.portal, tender_ref: tenderId, title: ref && ref !== tenderId ? `${title} (Ref ${ref})` : title,
          authority: org.split("||")[0].trim() || org, department: org.split("||").slice(1).join(" / ").trim() || null,
          published_on: parseIstDate(r.cells[1])?.slice(0, 10) || null, due_at: parseIstDate(r.cells[2]), opening_at: parseIstDate(r.cells[3]),
          state: site.state || stateFrom(org), industry_pack: industryPack(title), url: site.base + LIST, _detail: r.href,
        });
      }
      const next = await page.$("a#linkFwd, a:has-text('Next >')");
      if (!next || rows.length === 0) break;
      await Promise.all([page.waitForLoadState("domcontentloaded"), next.click()]);
    }
    // detail pages (value, EMD, pre-bid) — links are session-bound, so open them in the same context
    for (const t of out) {
      if (!t._detail) continue;
      try {
        const href = t._detail.startsWith("http") ? t._detail : new URL(t._detail, site.base + "/").toString();
        const d = await ctx.newPage();
        await d.goto(href, { waitUntil: "domcontentloaded", timeout: 45000 });
        const cells = await d.$$eval("table tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText)));
        Object.assign(t, Object.fromEntries(Object.entries(parseDetail(cells)).filter(([, v]) => v !== null && v !== undefined)));
        if (!t.state && t.location) t.state = stateFrom(t.location);
        await d.close();
        await new Promise((r) => setTimeout(r, 1500)); // polite pace
      } catch (e) {
        log(`  detail failed ${site.portal} ${t.tender_ref}: ${e.message}`);
      }
      delete t._detail;
    }
  } finally {
    await ctx.close();
  }
  return out;
}
