// Probe a GePNIC tender's detail page: its document links and what clicking one does (captcha or download).
// Run from the workflow with probe=true; ONLY_PORTALS picks the portals (default CPPP). Logs only.
import { chromium } from "playwright";
import { GEPNIC } from "./sources.js";
import { hasCaptcha } from "./captcha.js";

const only = (process.env.ONLY_PORTALS || "CPPP").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
try {
  for (const site of GEPNIC.filter((s) => only.some((o) => s.portal.toLowerCase().includes(o)))) {
    const ctx = await browser.newContext({ locale: "en-IN", acceptDownloads: true });
    const page = await ctx.newPage();
    const L = (label, x) => log(`${site.portal} | ${label} | ${JSON.stringify(x)}`);
    try {
      await page.goto(site.base + "?page=FrontEndTendersByOrganisation&service=page", { waitUntil: "domcontentloaded", timeout: 45000 });
      const org = await page.$$eval("table#table tr, table.list_table tr", (trs) => trs.map((tr) => ({ c: [...tr.cells].map((td) => td.innerText.trim()), href: tr.querySelector("a")?.getAttribute("href") })).find((r) => r.href && Number(r.c[2]) >= 2));
      await page.goto(new URL(org.href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
      const t = await page.$$eval("table#table tr, table.list_table tr", (trs) => trs.map((tr) => ({ c: [...tr.cells].map((td) => td.innerText.trim()), href: tr.querySelector("td a")?.getAttribute("href") })).find((r) => r.href && /^\d+\.?$/.test(r.c[0] || "")));
      L("tender", { org: org.c[1], title: t.c[4].slice(0, 120) });
      await page.goto(new URL(t.href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
      L("detail captcha", await hasCaptcha(page));
      L("section headings", await page.$$eval("td.pageheader, td.section_head, .textbold1, b, strong", (xs) => [...new Set(xs.map((x) => x.innerText.trim()).filter((x) => x && x.length < 60))].slice(0, 40)));
      const links = await page.$$eval("a", (as) => as.map((a) => ({ t: a.innerText.trim().slice(0, 60), id: a.id || null, href: (a.getAttribute("href") || "").slice(0, 140), title: a.title || null,
        section: (a.closest("table")?.closest("table")?.innerText || "").replace(/\s+/g, " ").slice(0, 50) }))
        .filter((x) => /\.(pdf|xls|xlsx|doc|docx|zip|rar)\b/i.test(x.t + x.href) || /download|docDownload|DirectLink/i.test(x.href + x.id) && !/^link1$/.test(x.id || "")));
      L("document-like links", links.slice(0, 25));
      L("work description", await page.evaluate(() => { const td = [...document.querySelectorAll("td")].find((x) => /^work description$/i.test(x.innerText.trim())); return td?.nextElementSibling?.innerText.slice(0, 200) || null; }));
      // click the first PDF link and see what happens
      const first = await page.$$("a").then(async (as) => { for (const a of as) { const s = (await a.innerText()) + (await a.getAttribute("href") || ""); if (/\.pdf\b/i.test(s)) return a; } return null; });
      if (first) {
        const dl = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
        await first.click().catch((e) => L("click error", e.message.split("\n")[0]));
        const d = await dl;
        if (d) L("download", { name: d.suggestedFilename() });
        else {
          await page.waitForTimeout(2000);
          L("after click", { url: page.url().slice(0, 140), captcha: await hasCaptcha(page), title: await page.title(),
            inputs: await page.$$eval("input", (xs) => xs.filter((x) => x.type !== "hidden").map((x) => `${x.type}:${x.name || x.id}=${x.value?.slice(0, 20)}`)),
            imgs: await page.$$eval("img", (xs) => xs.map((x) => x.id || x.src.slice(-40)).slice(0, 10)) });
        }
      } else L("no pdf link", null);
    } catch (e) { L("FAILED", e.message.split("\n")[0]); }
    await ctx.close();
  }
} finally {
  await browser.close();
}
