// Bihar eProc2 (eproc2.bihar.gov.in): the public "Open area Tender List" page loads every open tender in one data
// call (rest/openarea/getTenderList) and the department names in another (rest/organization/loadAllDeptWithParent).
// We open the page as a visitor and read both answers. No login, no captcha. The site sometimes drops the first
// connection, so the page is tried up to three times.
import { industryPack, rupees } from "../classify.js";

export const BIHAR = { portal: "Bihar eProc", base: "https://eproc2.bihar.gov.in/EPSV2Web", state: "Bihar" };

const iso = (ms) => (Number(ms) > 0 ? new Date(Number(ms)).toISOString() : null);
const istDay = (ms) => (Number(ms) > 0 ? new Date(Number(ms) + 330 * 60000).toISOString().slice(0, 10) : null);

// getTenderList answer (+ department list) → tender rows for ingest_tenders
export function parseBihar(list, depts = [], site = BIHAR) {
  const dept = new Map((depts || []).map((d) => [Number(d.organizationId), String(d.organizationName || "").trim()]));
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const id = t.currenttenderid, title = String(t.currentdescription || "").replace(/\s+/g, " ").trim();
    if (!id || !title) continue;
    const ref = String(t.currenttenderrefno || "").trim();
    out.push({
      portal: site.portal, tender_ref: String(id), title: (ref ? `${title} (Ref ${ref})` : title).slice(0, 1000),
      authority: dept.get(Number(t.currentdeptid)) || "Government of Bihar", state: site.state,
      value_inr: rupees(t.currentpacamt), published_on: istDay(t.currentTenderPublishDate),
      due_at: iso(t.currentbidEndDate), opening_at: iso(t.currentbidOpenDate),
      industry_pack: industryPack(title), url: `${site.base}/openarea/tenderListingPage.action`,
    });
  }
  return out;
}

export async function crawlBihar(browser, { log = console.log, progress = () => {}, site = BIHAR } = {}) {
  const ctx = await browser.newContext({ locale: "en-IN" });
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await ctx.newPage();
      try {
        progress({ phase: "listing", page: attempt, of: 3 });
        const listP = page.waitForResponse((r) => r.url().includes("/openarea/getTenderList"), { timeout: 90000 }).catch(() => null);
        const deptP = page.waitForResponse((r) => r.url().includes("loadAllDeptWithParent"), { timeout: 90000 }).catch(() => null);
        await page.goto(`${site.base}/openarea/tenderListingPage.action`, { waitUntil: "domcontentloaded", timeout: 60000 });
        const [lr, dr] = await Promise.all([listP, deptP]);
        const list = lr ? await lr.json().catch(() => null) : null;
        const depts = dr ? await dr.json().catch(() => []) : [];
        if (!Array.isArray(list)) throw new Error("the tender list did not load");
        const rows = parseBihar(list, depts, site);
        log(`  ${site.portal}: ${rows.length} open tenders`);
        return rows;
      } catch (e) {
        log(`  ${site.portal} try ${attempt}: ${e.message.split("\n")[0]}`);
        await new Promise((r) => setTimeout(r, 15000 * attempt));
      } finally {
        await page.close().catch(() => {});
      }
    }
    return [];
  } finally {
    await ctx.close();
  }
}
