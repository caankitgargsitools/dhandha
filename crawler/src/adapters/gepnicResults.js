// NIC GePNIC "Results of Tenders": public award-of-contract (AOC) notices. Each award names the
// selected bidder(s), their address, the contract value and date. These become tender-winner leads.
// Only the public result pages are read; the captcha-protected "Tender Status" search is never touched.
import { parseIstDate, rupees, industryPack, stateFrom } from "../classify.js";
import { parseTitleCell } from "./gepnic.js";

const LIST = "?page=ResultOfTenders&service=page";
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
// calendar day in India; slicing the UTC timestamp would give the previous day for midnight IST
const istDay = (s) => { const iso = parseIstDate(s); return iso ? new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10) : null; };

// Finds column positions from the header row, so a re-ordered table still parses.
export function resultColumns(header) {
  const h = header.map((x) => norm(x).toLowerCase());
  const find = (re) => h.findIndex((x) => re.test(x));
  return {
    id: find(/tender id/), title: find(/title|work|description/), org: find(/organi[sz]ation|department/),
    date: find(/aoc|award|contract date|result date|published/), stage: find(/stage|status/),
  };
}

// List rows -> awards to open. `rows` are { cells, href } from the results table, header excluded.
export function parseResultsList(header, rows, site) {
  const c = resultColumns(header);
  if (c.title < 0) return [];
  const out = [];
  for (const r of rows) {
    const cell = (i) => (i >= 0 ? norm(r.cells[i]) : "");
    const t = parseTitleCell(r.cells[c.title]);
    const tenderId = cell(c.id) || t.tenderId;
    if (!tenderId || !t.title) continue;
    const stage = cell(c.stage);
    if (stage && !/aoc|award|contract|concluded|complete/i.test(stage)) continue; // cancelled / retendered
    const org = cell(c.org);
    out.push({
      portal: site.portal, tender_ref: tenderId, title: t.title,
      authority: org.split("||")[0].trim() || org || site.portal, state: site.state || stateFrom(org),
      industry_pack: industryPack(t.title), listed_on: istDay(cell(c.date)), _detail: r.href,
    });
  }
  return out;
}

// AOC detail page. `tables` is every <table> on the page as rows of cell text.
// Handles both layouts seen on GePNIC: label/value pairs, and a bidders table with a header row.
export function parseAoc(tables) {
  const map = {};
  for (const rows of tables) for (const r of rows) for (let i = 0; i + 1 < r.length; i += 2) {
    const k = norm(r[i]).toLowerCase().replace(/[:*]/g, "").trim();
    if (k && !(k in map)) map[k] = String(r[i + 1] || "").trim();
  }
  const get = (...keys) => { for (const k of keys) for (const [mk, v] of Object.entries(map)) if (mk.startsWith(k) && v) return v; return null; };
  const contract_date = istDay(get("contract date", "date of contract", "aoc date", "award date"));
  const value = rupees(get("contract value", "awarded value", "value of contract", "aoc value"));

  // bidders table: header row has "bidder name"; awarded rows say AOC / Awarded / L1, or there is only one
  for (const rows of tables) {
    const hi = rows.findIndex((r) => r.some((x) => /bidder\s*name|name of (the )?bidder/i.test(x)));
    if (hi < 0) continue;
    const head = rows[hi].map((x) => norm(x).toLowerCase());
    const col = (re) => head.findIndex((x) => re.test(x));
    const ni = col(/bidder\s*name|name of (the )?bidder/), ai = col(/address/), vi = col(/value|amount|price/), si = col(/status|rank|result/);
    const body = rows.slice(hi + 1).filter((r) => norm(r[ni]));
    const won = body.filter((r) => si < 0 ? body.length === 1 : !/not|reject|disqualif|unsuccess/i.test(r[si]) && /aoc|award|selected|accepted|\bl-?1\b/i.test(r[si]));
    if (won.length) return won.map((r) => ({
      bidder_name: norm(r[ni]), bidder_address: ai >= 0 ? norm(r[ai]) || null : null,
      awarded_value: (vi >= 0 && rupees(r[vi])) || value, contract_date,
    }));
  }
  const names = get("name of the selected bidder", "name of selected bidder", "selected bidder", "successful bidder", "bidder name");
  if (!names) return [];
  const addrs = String(get("address of the selected bidder", "address of selected bidder", "bidder address") || "").split(/\n|;/).map(norm);
  return names.split(/\n|;/).map(norm).filter(Boolean).map((n, i) => ({
    bidder_name: n, bidder_address: addrs[i] || (addrs.length === 1 ? addrs[0] : null) || null, awarded_value: value, contract_date,
  }));
}

// "Plot 12, Sector 37, Gurugram, Haryana - 122001" -> "Gurugram"
export function cityFrom(address) {
  const parts = String(address || "").split(/,|\n/).map((p) => p.replace(/\b\d{6}\b|pin(code)?\s*[:-]?/gi, "").replace(/[-–]\s*$/, "").trim()).filter(Boolean);
  const notCity = (p) => /\d/.test(p) || /^india$/i.test(p) || (stateFrom(p) && p.length <= stateFrom(p).length + 3);
  for (let i = parts.length - 1; i >= 0; i--) if (!notCity(parts[i])) return parts[i].replace(/^(dist(rict)?\.?|city)\s*/i, "").slice(0, 80);
  return null;
}

export async function crawlGepnicResults(browser, site, { maxPages = 10, maxAwards = 300, log = console.log } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN", userAgent: "Mozilla/5.0 (DhandhaBot; tender alerts for registered businesses)" });
  const page = await ctx.newPage();
  const list = [];
  const out = [];
  try {
    await page.goto(site.base + LIST, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (await page.$("img#captchaImage, input[name*=captcha i]")) { log(`  ${site.portal} results page asks for a captcha — skipped`); return []; }
    for (let p = 0; p < maxPages && list.length < maxAwards; p++) {
      const { header, rows } = await page.$$eval("table.list_table tr, table#table tr", (trs) => {
        const all = trs.map((tr) => ({ cells: [...tr.querySelectorAll("td, th")].map((td) => td.innerText.trim()), href: tr.querySelector("td a")?.getAttribute("href") || null }));
        const hi = all.findIndex((r) => r.cells.some((c) => /tender id|title/i.test(c)) && r.cells.length >= 4);
        return { header: hi >= 0 ? all[hi].cells : [], rows: all.filter((r, i) => i > hi && r.cells.length >= 4 && /^\d+\.?$/.test(r.cells[0])) };
      });
      list.push(...parseResultsList(header, rows, site));
      const next = await page.$("a#linkFwd, a:has-text('Next >')");
      if (!next || rows.length === 0) break;
      await Promise.all([page.waitForLoadState("domcontentloaded"), next.click()]);
    }
    for (const a of list.slice(0, maxAwards)) {
      if (!a._detail) continue;
      try {
        const href = a._detail.startsWith("http") ? a._detail : new URL(a._detail, site.base + "/").toString();
        const d = await ctx.newPage();
        await d.goto(href, { waitUntil: "domcontentloaded", timeout: 45000 });
        const tables = await d.$$eval("table", (ts) => ts.map((t) => [...t.querySelectorAll(":scope > tbody > tr, :scope > tr")].map((tr) => [...tr.querySelectorAll(":scope > td, :scope > th")].map((td) => td.innerText))));
        await d.close();
        for (const b of parseAoc(tables)) {
          const { _detail, listed_on, ...award } = a;
          out.push({ ...award, ...b, contract_date: b.contract_date || listed_on, bidder_city: cityFrom(b.bidder_address), url: site.base + LIST }); // detail links are session-bound
        }
        await new Promise((r) => setTimeout(r, 1500)); // polite pace
      } catch (e) {
        log(`  result failed ${site.portal} ${a.tender_ref}: ${e.message}`);
      }
    }
  } finally {
    await ctx.close();
  }
  return out;
}
