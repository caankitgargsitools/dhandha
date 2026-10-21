// NIC GePNIC portals (CPPP, Defence and most states). Reads "Latest Active Tenders",
// opens each tender's detail page for value / EMD / pre-bid, never touches captcha-protected downloads.
import { parseIstDate, rupees, industryPack, stateFrom } from "../classify.js";
import { dumpPage } from "../dump.js";

// "Tenders by Closing Date" is public (no captcha) and has the same columns the old Latest Active list had.
const LIST = "?page=FrontEndListTendersbyDate&service=page";

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

export async function crawlGepnic(browser, site, { maxPages = 20, log = console.log, progress = () => {} } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN", userAgent: "Mozilla/5.0 (DhandhaBot; tender alerts for registered businesses)" });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.goto(site.base + LIST, { waitUntil: "domcontentloaded", timeout: 60000 });
    // the page opens on "Closing Today"; widen it to the next 14 days (later ones show up on later runs)
    // The tab is a "javascript:tapestry.form.submit(...)" link; a plain click did not switch it, so run the
    // portal's own submit and wait for the new page.
    const tab = (await page.$("a:text-is('Closing within 14 days')")) || (await page.$("a#LinkSubmit_1"));
    const js = tab && (await tab.getAttribute("href"));
    if (js) {
      const nav = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
      const m = js.match(/submit\('([^']+)',\s*'([^']+)'\)/);
      if (m) {
        // what tapestry.form.submit(form, name) does: name the pressed control, then submit the form
        await page.evaluate(([formName, name]) => {
          const f = document.forms[formName] || document.getElementById(formName);
          let i = f.querySelector("input[name=submitname]");
          if (!i) { i = document.createElement("input"); i.type = "hidden"; i.name = "submitname"; f.appendChild(i); }
          i.value = name;
          HTMLFormElement.prototype.submit.call(f);
        }, [m[1], m[2]]);
      } else await tab.click();
      if (!(await nav)) log(`  ${site.portal}: the 14-day tab did not load; reading the default list`);
    }
    // the list is sorted soonest-closing first, so the first pages are tenders closing today; start from the
    // last page (most time left to bid) and walk backwards
    const go = async (a) => {
      const href = a && (await a.getAttribute("href"));
      if (!href || href.startsWith("javascript")) return false;
      await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      return true;
    };
    const backwards = await go(await page.$("a#linkLast")).catch(() => false);
    const seen = new Set();
    for (let p = 0; p < maxPages; p++) {
      progress({ phase: "listing", page: p + 1, of: maxPages });
      const rows = await page.$$eval("table.list_table tr, table#table tr", (trs) =>
        trs.map((tr) => {
          const tds = [...tr.querySelectorAll("td")];
          const a = tr.querySelector("td a");
          return { cells: tds.map((td) => td.innerText.trim()), href: a ? a.getAttribute("href") : null };
        }).filter((r) => r.cells.length >= 6 && /^\d+\.?$/.test(r.cells[0])));
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
      if (p === 0 && rows.length === 0) await dumpPage(page, `${site.portal} tenders`, log);
      if (p === 0 && rows.length) log(`  ${site.portal}: first page closes ${rows[0].cells[2]} … ${rows[rows.length - 1].cells[2]}`);
      if (rows.length === 0) break;
      const next = await page.$(backwards ? "a#linkBwd, a:text-is('<')" : "a#linkFwd, a:has-text('Next >')");
      // a slow portal on a later page keeps what was read so far
      try { if (!(await go(next))) break; }
      catch (e) { log(`  ${site.portal} page ${p + 2} did not load (${e.message.split("\n")[0]}) — keeping ${out.length}`); break; }
      await new Promise((r) => setTimeout(r, 1000)); // polite pace
    }
    // detail pages (value, EMD, pre-bid) — links are session-bound, so open them in the same context
    for (const [i, t] of out.entries()) {
      progress({ phase: "details", done: i, total: out.length });
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
