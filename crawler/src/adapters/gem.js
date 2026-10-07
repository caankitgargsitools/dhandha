// GeM BidPlus: ongoing bids from the public "All Bids" listing (JSON endpoint used by the page itself).
import { stateFrom, industryPack } from "../classify.js";

export function mapGemDoc(doc, base) {
  const num = Array.isArray(doc.b_bid_number) ? doc.b_bid_number[0] : doc.b_bid_number;
  const cat = Array.isArray(doc.b_category_name) ? doc.b_category_name[0] : doc.b_category_name;
  const ministry = [doc.ba_official_details_minName, doc.ba_official_details_deptName].flat().filter(Boolean).join(" / ");
  const end = Array.isArray(doc.final_end_date_sort) ? doc.final_end_date_sort[0] : doc.final_end_date_sort;
  const start = Array.isArray(doc.final_start_date_sort) ? doc.final_start_date_sort[0] : doc.final_start_date_sort;
  if (!num || !cat) return null;
  return {
    portal: "GeM", tender_ref: num, title: cat, authority: ministry || "GeM buyer",
    category: cat, industry_pack: industryPack(cat) || "goods_supply",
    published_on: start ? String(start).slice(0, 10) : null, due_at: end || null,
    state: stateFrom(ministry), url: `${base}/all-bids`,
  };
}

export async function crawlGem(browser, { maxPages = 20, log = console.log, base = "https://bidplus.gem.gov.in" } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(`${base}/all-bids`, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let p = 1; p <= maxPages; p++) {
      const res = await page.evaluate(async ({ p, base }) => {
        const csrf = document.querySelector("input[name=csrf_bd_gem_nk]")?.value
          || document.cookie.split("; ").find((c) => c.startsWith("csrf_gem_cookie="))?.split("=")[1] || "";
        const payload = { page: p, param: { searchBid: "", searchType: "fullText" },
          filter: { bidStatusType: "ongoing_bids", byType: "all", highBidValue: "", byEndDate: { from: "", to: "" }, sort: "Bid-Start-Date-Latest" } };
        const body = new URLSearchParams({ payload: JSON.stringify(payload), csrf_bd_gem_nk: csrf });
        const r = await fetch(`${base}/all-bids-data`, { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
        return r.ok ? r.json() : { error: r.status };
      }, { p, base });
      const docs = res?.response?.response?.docs || res?.response?.docs || [];
      if (res?.error) { log(`  GeM page ${p}: HTTP ${res.error}`); break; }
      for (const d of docs) { const m = mapGemDoc(d, base); if (m) out.push(m); }
      if (docs.length === 0) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
  } finally {
    await ctx.close();
  }
  return out;
}
