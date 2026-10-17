// GeM BidPlus results: for bids whose evaluation is public, the financial evaluation lists sellers with their
// price and rank. The L1 seller (or the row marked awarded / contract) is the winner and becomes a tender-winner lead.
// Uses the same public listing endpoint the GeM page itself calls; never touches captcha-protected pages.
import { stateFrom, industryPack } from "../classify.js";

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const first = (v) => (Array.isArray(v) ? v[0] : v);
const num = (v) => { const n = Number(String(v ?? "").replace(/[₹,\s]|rs\.?|inr/gi, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };

// Listing doc → the bid whose result page we open. Field names vary across GeM versions, so several are tried.
export function mapGemResultDoc(doc, base) {
  const num_ = first(doc.b_bid_number) || first(doc.bid_number);
  const id = first(doc.b_id) || first(doc.id) || first(doc.b_bid_id);
  const cat = first(doc.b_category_name) || first(doc.bd_category_name) || first(doc.category_name);
  if (!num_ || !id) return null;
  const ministry = [doc.ba_official_details_minName, doc.ba_official_details_deptName].flat().filter(Boolean).join(" / ");
  return {
    portal: "GeM", tender_ref: String(num_), title: cat ? String(cat) : String(num_), authority: ministry || "GeM buyer",
    industry_pack: industryPack(String(cat || "")) || "goods_supply", state: stateFrom(ministry),
    resultUrl: `${base}/bidding/bid/getBidResultView/${id}`,
  };
}

// Result page tables → winners. Prefers rows marked awarded/contract; else rank L1.
export function parseGemResult(tables) {
  for (const rows of tables) {
    const hi = rows.findIndex((r) => r.some((x) => /seller\s*name|bidder\s*name|vendor\s*name/i.test(x)));
    if (hi < 0) continue;
    const head = rows[hi].map((x) => norm(x).toLowerCase());
    const col = (re) => head.findIndex((x) => re.test(x));
    const ni = col(/seller\s*name|bidder\s*name|vendor\s*name/), pi = col(/total|offered price|price|amount|value/), ri = col(/rank/), si = col(/status|result|remark/);
    const body = rows.slice(hi + 1).filter((r) => norm(r[ni]).length > 1);
    if (!body.length) continue;
    const awarded = si >= 0 ? body.filter((r) => /award|contract|selected|accepted/i.test(r[si]) && !/not|reject|disqualif/i.test(r[si])) : [];
    const l1 = ri >= 0 ? body.filter((r) => /^\s*l-?\s*1\s*$/i.test(r[ri])) : [];
    const won = awarded.length ? awarded : l1;
    // a financial table without rank or status is not a result yet
    if (!won.length) continue;
    return won.map((r) => ({ bidder_name: norm(r[ni]).replace(/\s*\(.*?(msme|mse|startup).*?\)\s*/i, " ").trim(), awarded_value: pi >= 0 ? num(r[pi]) : null }));
  }
  return [];
}

export async function crawlGemResults(browser, { maxPages = 5, maxBids = 200, log = console.log, base = "https://bidplus.gem.gov.in", status = process.env.GEM_RESULT_STATUS || "bidrastatus" } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  const page = await ctx.newPage();
  const bids = [];
  const out = [];
  try {
    await page.goto(`${base}/all-bids`, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let p = 1; p <= maxPages && bids.length < maxBids; p++) {
      const res = await page.evaluate(async ({ p, base, status }) => {
        const csrf = document.querySelector("input[name=csrf_bd_gem_nk]")?.value
          || document.cookie.split("; ").find((c) => c.startsWith("csrf_gem_cookie="))?.split("=")[1] || "";
        const payload = { page: p, param: { searchBid: "", searchType: "fullText" },
          filter: { bidStatusType: status, byType: "all", highBidValue: "", byEndDate: { from: "", to: "" }, sort: "Bid-End-Date-Latest" } };
        const body = new URLSearchParams({ payload: JSON.stringify(payload), csrf_bd_gem_nk: csrf });
        const r = await fetch(`${base}/all-bids-data`, { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
        return r.ok ? r.json() : { error: r.status };
      }, { p, base, status });
      if (res?.error) { log(`  GeM results page ${p}: HTTP ${res.error}`); break; }
      const docs = res?.response?.response?.docs || res?.response?.docs || [];
      for (const d of docs) { const m = mapGemResultDoc(d, base); if (m) bids.push(m); }
      if (!docs.length) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
    for (const b of bids.slice(0, maxBids)) {
      try {
        const d = await ctx.newPage();
        await d.goto(b.resultUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        if (await d.$("img#captchaImage, input[name*=captcha i]")) { await d.close(); log("  GeM result page asks for a captcha — stopping"); break; }
        const tables = await d.$$eval("table", (ts) => ts.map((t) => [...t.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td, th")].map((td) => td.innerText))));
        await d.close();
        const { resultUrl, ...award } = b;
        for (const w of parseGemResult(tables)) out.push({ ...award, ...w, url: `${base}/all-bids` });
        await new Promise((r) => setTimeout(r, 1500)); // polite pace
      } catch (e) {
        log(`  GeM result failed ${b.tender_ref}: ${e.message}`);
      }
    }
  } finally {
    await ctx.close();
  }
  return out;
}
