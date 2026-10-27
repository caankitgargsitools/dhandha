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

// "26-10-2026 3:28 PM" (India time) → ISO with +05:30
export function gemDate(s) {
  const m = String(s || "").match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[4]) % 12; if ((m[6] || "").toUpperCase() === "PM") h += 12; if (!m[6]) h = Number(m[4]);
  const pad = (n) => String(n).padStart(2, "0");
  return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(h)}:${m[5]}:00+05:30`;
}

// The bid list as GeM shows it on the page (text of "All Bids"): Bid No., Items, Quantity, Department, Start/End Date.
// `links` maps a bid number to its bid document link (showbidDocument/<id>) where the page has one.
export function parseGemText(text, base = "https://bidplus.gem.gov.in", links = {}) {
  const out = [];
  const blocks = String(text || "").split(/\n\s*Bid No\.:\s*/).slice(1);
  for (const b of blocks) {
    const num = (b.match(/^(GEM\/\d{4}\/[A-Z]\/\d+)/) || [])[1];
    const items = (b.match(/Items:\s*([^\n]+)/) || [])[1];
    if (!num || !items) continue;
    const dept = ((b.match(/Department Name And Address:\s*\n([\s\S]*?)\n\s*Start Date:/) || [])[1] || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const start = gemDate((b.match(/Start Date:\s*([^\n]+)/) || [])[1]);
    const end = gemDate((b.match(/End Date:\s*([^\n]+)/) || [])[1]);
    const qty = (b.match(/Quantity:\s*([^\n]+)/) || [])[1];
    const title = items.replace(/\.\.\.$/, "").trim();
    const authority = dept.join(" / ") || "GeM buyer";
    out.push({ portal: "GeM", tender_ref: num, title: qty ? `${title} (qty ${qty.trim()})` : title, authority, department: dept[1] || null,
      category: title, industry_pack: industryPack(title) || "goods_supply", published_on: start ? start.slice(0, 10) : null, due_at: end,
      state: stateFrom(authority), url: links[num] || `${base}/all-bids` });
  }
  return out;
}

// Reads the list straight from the page, a page at a time (GeM's "Next" works by script, not links), for the latest
// bids and for each search word (GEM_SEARCH, e.g. audit, accountant): what a person sees on "All Bids".
async function crawlGemPage(page, { base, maxPages, words, log, progress }) {
  const out = new Map();
  for (const w of ["", ...words]) {
    await page.goto(`${base}/all-bids`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    if (w) {
      const box = await page.$("input[name=search]");
      if (!box) break;
      await box.fill(w); await box.press("Enter");
      await page.waitForTimeout(4000);
    }
    let last = "";
    for (let p = 1; p <= maxPages; p++) {
      progress({ phase: w ? `search “${w}”` : "latest", page: p, of: maxPages });
      const text = await page.evaluate(() => document.body.innerText).catch(() => "");
      const links = await page.$$eval("a[href*='showbidDocument']", (as) => Object.fromEntries(as.map((a) => [a.innerText.trim(), a.href]))).catch(() => ({}));
      const rows = parseGemText(text, base, links);
      if (!rows.length || rows[0].tender_ref === last) break;
      last = rows[0].tender_ref;
      for (const r of rows) out.set(r.tender_ref, r);
      const next = await page.$("a:has-text('Next'), li.next a, a.page-link:has-text('Next')");
      if (!next) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(2500);
    }
    log(`  GeM ${w ? `“${w}”` : "latest"}: ${out.size} bids so far`);
  }
  return [...out.values()];
}

export async function crawlGem(browser, { maxPages = 20, log = console.log, base = "https://bidplus.gem.gov.in", progress = () => {}, words = (process.env.GEM_SEARCH || "audit,chartered accountant,accounting,accounts,internal audit,GST,taxation,valuation,financial consultant").split(",").map((x) => x.trim()).filter(Boolean) } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(`${base}/all-bids`, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let p = 1; p <= maxPages; p++) {
      progress({ phase: "listing", page: p, of: maxPages });
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
    // the data address answered nothing (it changes): read the page itself instead
    if (!out.length) out.push(...await crawlGemPage(page, { base, maxPages, words, log, progress }));
  } finally {
    await ctx.close();
  }
  return out;
}
