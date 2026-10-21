// Probe: which public GePNIC list pages show tenders without a captcha? Logs a short summary per page.
// Run from the workflow with probe=true; ONLY_PORTALS picks the portals (default CPPP).
import { chromium } from "playwright";
import { GEPNIC } from "./sources.js";

const PAGES = [
  ["Home", "?page=Home&service=page"],
  ["By organisation", "?page=FrontEndTendersByOrganisation&service=page"],
  ["By closing date", "?page=FrontEndListTendersbyDate&service=page"],
  ["By location", "?page=FrontEndTendersByLocation&service=page"],
  ["By classification", "?page=FrontEndTendersByClassification&service=page"],
  ["Latest active", "?page=FrontEndLatestActiveTenders&service=page"],
];
const only = (process.env.ONLY_PORTALS || "CPPP").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
try {
  for (const site of GEPNIC.filter((s) => only.some((o) => s.portal.toLowerCase().includes(o)))) {
    const ctx = await browser.newContext({ locale: "en-IN" });
    const page = await ctx.newPage();
    for (const [label, path] of PAGES) {
      try {
        await page.goto(site.base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
        const info = await page.evaluate(() => {
          const text = document.body.innerText;
          const captcha = !!document.querySelector("img[id*=aptcha i], input[name*=aptcha i]") || /enter captcha/i.test(text);
          const tables = [...document.querySelectorAll("table")].map((t) => {
            const rows = [...t.querySelectorAll(":scope > tbody > tr, :scope > tr")];
            const dataRows = rows.filter((r) => /^\s*\d+\.?\s*$/.test(r.cells[0]?.innerText || ""));
            return { id: t.id, cls: t.className, rows: rows.length, data: dataRows.length, links: t.querySelectorAll("a").length,
              head: rows.find((r) => r.cells.length >= 3 && !/^\s*\d/.test(r.cells[0]?.innerText || ""))?.innerText.replace(/\s+/g, " ").slice(0, 160),
              first: dataRows.slice(0, 2).map((r) => [...r.cells].map((c) => c.innerText.replace(/\s+/g, " ").trim().slice(0, 70))),
              firstHref: dataRows[0]?.querySelector("a")?.getAttribute("href")?.slice(0, 140) };
          }).filter((t) => t.data > 0);
          return { title: document.title, captcha, tables };
        });
        log(`${site.portal} | ${label} | captcha=${info.captcha} | ${info.tables.length} data tables`);
        for (const t of info.tables.slice(0, 3)) log(`   id=${t.id} class=${t.cls} rows=${t.rows} data=${t.data} links=${t.links} head=${JSON.stringify(t.head)} first=${JSON.stringify(t.first)} href=${t.firstHref}`);
      } catch (e) { log(`${site.portal} | ${label} | FAILED ${e.message.split("\n")[0]}`); }
    }
    // drill-down: first organisation's tender list, and the closing-date page's own links
    for (const [label, path] of [["Org drill-down", "?page=FrontEndTendersByOrganisation&service=page"], ["Closing-date links", "?page=FrontEndListTendersbyDate&service=page"]]) {
      try {
        await page.goto(site.base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
        const links = await page.$$eval("table.list_table a, a[id^=link], a:has-text('Next')", (as) => as.slice(0, 25).map((a) => ({ t: a.innerText.trim().slice(0, 60), id: a.id || null })));
        log(`${site.portal} | ${label} links: ${JSON.stringify(links.slice(0, 12))}`);
        if (label === "Org drill-down") {
          const first = await page.$("table.list_table tr td a");
          if (first) {
            await Promise.all([page.waitForLoadState("domcontentloaded"), first.click()]);
            const info = await page.evaluate(() => {
              const captcha = !!document.querySelector("img[id*=aptcha i], input[name*=aptcha i]") || /enter captcha/i.test(document.body.innerText);
              const t = document.querySelector("table.list_table, table#table");
              const rows = t ? [...t.querySelectorAll("tr")] : [];
              const data = rows.filter((r) => /^\s*\d+\.?\s*$/.test(r.cells[0]?.innerText || ""));
              const nav = [...document.querySelectorAll("a")].map((a) => a.innerText.trim()).filter((x) => /next|>>|last|prev/i.test(x)).slice(0, 6);
              return { captcha, rows: rows.length, data: data.length, head: rows[0]?.innerText.replace(/\s+/g, " ").slice(0, 160),
                first: data.slice(0, 2).map((r) => [...r.cells].map((c) => c.innerText.replace(/\s+/g, " ").trim().slice(0, 70))), nav };
            });
            log(`${site.portal} | Org drill-down result: ${JSON.stringify(info)}`);
          }
        }
      } catch (e) { log(`${site.portal} | ${label} FAILED ${e.message.split("\n")[0]}`); }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
