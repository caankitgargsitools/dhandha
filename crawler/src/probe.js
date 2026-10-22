// Probe a GePNIC portal's public list pages and log what a crawler would see. Run from the workflow with
// probe=true; ONLY_PORTALS picks the portals (default CPPP). Logs only — nothing is sent to Dhandha.
import { chromium } from "playwright";
import { GEPNIC } from "./sources.js";

const only = (process.env.ONLY_PORTALS || "CPPP").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const log = (...a) => console.log(...a);

// heading of the list, captcha flag, data rows (first and last closing dates)
const summary = (page) => page.evaluate(() => {
  const t = document.querySelector("table#table, table.list_table");
  const rows = t ? [...t.querySelectorAll("tr")].filter((r) => /^\s*\d+\.?\s*$/.test(r.cells[0]?.innerText || "")) : [];
  const heads = [...document.querySelectorAll("td.page_title, .page_title, td.list_header, h2, h3, b")].map((x) => x.innerText.trim()).filter((x) => /closing|tender|organisation/i.test(x)).slice(0, 4);
  return {
    url: location.href.slice(0, 120), heads, captcha: !!document.querySelector("img[id*=aptcha i], input[name*=aptcha i]"),
    rows: rows.length, first: rows[0] ? [...rows[0].cells].map((c) => c.innerText.trim().slice(0, 40)) : null,
    lastDue: rows.at(-1)?.cells[2]?.innerText.trim() || null, noData: /No Tenders found/i.test(document.body.innerText),
  };
});

const browser = await chromium.launch();
try {
  for (const site of GEPNIC.filter((s) => only.some((o) => s.portal.toLowerCase().includes(o)))) {
    const ctx = await browser.newContext({ locale: "en-IN" });
    const page = await ctx.newPage();
    const L = (label, x) => log(`${site.portal} | ${label} | ${JSON.stringify(x)}`);
    try {
      // 1. closing-date page: its form, the tab links, and what each way of switching to 14 days gives
      await page.goto(site.base + "?page=FrontEndListTendersbyDate&service=page", { waitUntil: "domcontentloaded", timeout: 45000 });
      L("closing-date default", await summary(page));
      L("forms", await page.evaluate(() => [...document.forms].map((f) => ({ name: f.name, id: f.id, action: f.getAttribute("action"), method: f.method,
        inputs: [...f.elements].map((e) => `${e.tagName.toLowerCase()}:${e.type}:${e.name}=${String(e.value).slice(0, 30)}`).slice(0, 30) }))));
      L("tab links", await page.$$eval("a", (as) => as.filter((a) => /closing/i.test(a.innerText)).map((a) => ({ t: a.innerText.trim(), id: a.id, href: a.getAttribute("href"), onclick: a.getAttribute("onclick") }))));
      L("scripts", await page.evaluate(() => ({ tapestry: typeof window.tapestry, form: typeof window.tapestry?.form, dojo: typeof window.dojo, srcs: [...document.scripts].map((s) => s.src).filter(Boolean).slice(0, 8) })));
      const tab = page.locator("a", { hasText: "Closing within 14 days" }).first();
      if (await tab.count()) {
        await Promise.all([page.waitForLoadState("domcontentloaded"), tab.click({ timeout: 15000 })]).catch((e) => L("real click error", e.message.split("\n")[0]));
        await page.waitForTimeout(4000);
        L("after real click", await summary(page));
      }
      // 2. Organisation list → first organisation's tenders (all active tenders of that organisation)
      await page.goto(site.base + "?page=FrontEndTendersByOrganisation&service=page", { waitUntil: "domcontentloaded", timeout: 45000 });
      const orgs = await page.$$eval("table#table tr, table.list_table tr", (trs) => trs.map((tr) => ({ c: [...tr.cells].map((td) => td.innerText.trim()), href: tr.querySelector("a")?.getAttribute("href") })).filter((r) => r.href && /^\d+\.?$/.test(r.c[0] || "")));
      L("organisations", { count: orgs.length, tenders: orgs.reduce((s, r) => s + (Number(r.c[2]) || 0), 0), first: orgs[0]?.c });
      const pick = orgs.find((r) => Number(r.c[2]) >= 3) || orgs[0];
      if (pick) {
        await page.goto(new URL(pick.href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
        L(`org "${pick.c[1]}" (${pick.c[2]})`, await summary(page));
        L("org page nav", await page.$$eval("a[id^=link]", (as) => as.map((a) => `${a.id}:${a.innerText.trim()}`).slice(0, 12)));
      }
    } catch (e) { L("FAILED", e.message.split("\n")[0]); }
    await ctx.close();
  }
} finally {
  await browser.close();
}
