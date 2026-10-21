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
    await ctx.close();
  }
} finally {
  await browser.close();
}
