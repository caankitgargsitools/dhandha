// NIC GePNIC portals (CPPP, Defence and most states). Reads every active tender through the public
// "Tenders by Organisation" pages, opens the newest tenders' detail pages for value / EMD / pre-bid,
// never touches captcha-protected pages.
import { parseIstDate, rupees, industryPack, stateFrom } from "../classify.js";
import { dumpPage } from "../dump.js";

// the link stored on each tender (the public closing-date list)
const LIST = "?page=FrontEndListTendersbyDate&service=page";
const ORGS = "?page=FrontEndTendersByOrganisation&service=page";

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

export async function crawlGepnic(browser, site, { maxOrgs = 400, maxDetails = 40, log = console.log, progress = () => {}, wanted = new Set() } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN", userAgent: "Mozilla/5.0 (DhandhaBot; tender alerts for registered businesses)" });
  const page = await ctx.newPage();
  const out = [];
  try {
    // "Tenders by Organisation" is public (no captcha): the list of organisations with their tender counts,
    // and each organisation's page lists all of its active tenders. Together that is every active tender.
    await page.goto(site.base + ORGS, { waitUntil: "domcontentloaded", timeout: 60000 });
    const orgs = await page.$$eval("table.list_table tr, table#table tr", (trs) => trs
      .map((tr) => ({ cells: [...tr.querySelectorAll("td")].map((td) => td.innerText.trim()), href: tr.querySelector("td a")?.getAttribute("href") }))
      .filter((r) => r.href && /^\d+\.?$/.test(r.cells[0] || "")));
    if (!orgs.length) await dumpPage(page, `${site.portal} organisations`, log);
    const todo = orgs.slice(0, maxOrgs);
    log(`  ${site.portal}: ${orgs.length} organisations, ${orgs.reduce((n, o) => n + (Number(o.cells[2]) || 0), 0)} active tenders listed`);
    const seen = new Set();
    for (const [i, o] of todo.entries()) {
      progress({ phase: "listing", page: i + 1, of: todo.length });
      try {
        await page.goto(new URL(o.href, site.base + "/").toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      } catch (e) { log(`  ${site.portal}: ${o.cells[1]} did not load (${e.message.split("\n")[0]})`); continue; }
      const rows = await page.$$eval("table.list_table tr, table#table tr", (trs) =>
        trs.map((tr) => {
          const tds = [...tr.querySelectorAll("td")];
          const a = tr.querySelector("td a");
          return { cells: tds.map((td) => td.innerText.trim()), href: a ? a.getAttribute("href") : null };
        }).filter((r) => r.cells.length >= 6 && /^\d+\.?$/.test(r.cells[0])));
      if (!rows.length && Number(o.cells[2]) > 0 && i === 0) {
        log(`  ${site.portal}: ${o.cells[1]} showed no tenders (expected ${o.cells[2]})`);
        await dumpPage(page, `${site.portal} organisation`, log);
      }
      for (const r of rows) {
        const { title, ref, tenderId } = parseTitleCell(r.cells[4]);
        if (!tenderId || seen.has(tenderId)) continue;
        seen.add(tenderId);
        const org = r.cells[5];
        out.push({
          portal: site.portal, tender_ref: tenderId, title: ref && ref !== tenderId ? `${title} (Ref ${ref})` : title,
          authority: org.split("||")[0].trim() || org, department: org.split("||").slice(1).join(" / ").trim() || null,
          published_on: parseIstDate(r.cells[1])?.slice(0, 10) || null, due_at: parseIstDate(r.cells[2]), opening_at: parseIstDate(r.cells[3]),
          state: site.state || stateFrom(org), industry_pack: industryPack(title), url: site.base + LIST, _detail: r.href,
        });
      }
      await new Promise((r) => setTimeout(r, 800)); // polite pace
    }
    // Detail pages (value, EMD, pre-bid) cost a page load each, so only the newest few per run; the rest get
    // theirs on later runs or when a company opens the tender.
    // Tenders a company is already interested in but without value / EMD go first (`wanted`, from detail_wanted).
    const cutoff = Date.now() + 2 * 864e5;
    const first = out.filter((t) => t._detail && wanted.has(t.tender_ref)).slice(0, 120);
    const newest = out.filter((t) => t._detail && Date.parse(t.due_at) > cutoff && !wanted.has(t.tender_ref))
      .sort((a, b) => String(b.published_on).localeCompare(String(a.published_on))).slice(0, maxDetails);
    const detailed = new Set([...first, ...newest]);
    // detail pages (value, EMD, pre-bid) — links are session-bound, so open them in the same context
    for (const [i, t] of [...detailed].entries()) {
      progress({ phase: "details", done: i, total: detailed.size });
      let d = null;
      try {
        const href = t._detail.startsWith("http") ? t._detail : new URL(t._detail, site.base + "/").toString();
        d = await ctx.newPage();
        await d.goto(href, { waitUntil: "domcontentloaded", timeout: 45000 });
        const cells = await d.$$eval("table tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText)));
        Object.assign(t, Object.fromEntries(Object.entries(parseDetail(cells)).filter(([, v]) => v !== null && v !== undefined)));
        if (!t.state && t.location) t.state = stateFrom(t.location);
        await new Promise((r) => setTimeout(r, 1500)); // polite pace
      } catch (e) {
        log(`  detail failed ${site.portal} ${t.tender_ref}: ${e.message}`);
      } finally {
        await d?.close().catch(() => {});
      }
    }
    for (const t of out) delete t._detail;
  } finally {
    await ctx.close();
  }
  return out;
}
