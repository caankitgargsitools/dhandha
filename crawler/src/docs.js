// Tender document fetcher. The tender assistant in Dhandha queues a job; this worker claims it, finds the tender
// on its GePNIC portal (organisation list → organisation → tender), reads the detail page, and downloads the
// tender documents. Where the portal asks for a captcha, the picture is shown in the assistant chat and a person
// types it; nothing reads or solves captchas here. Files go back to Dhandha in chunks (doc_job_put_chunk).
//   node src/docs.js --until-idle [--wait 90]   process queued jobs, waiting up to 90 s for the first one
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { GEPNIC } from "./sources.js";
import { parseDetail } from "./adapters/gepnic.js";
import { unzip } from "./unzip.js";

const env = process.env;
for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "INGEST_KEY"]) if (!env[k]) { console.error(`Missing ${k}`); process.exit(1); }
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUNNER = env.RUNNER_NAME || "docs";
const MAX_FILES = 15, MAX_BYTES = 25 * 1024 * 1024, CHUNK = 2 * 1024 * 1024;
const CAPTCHA_IMG = "img#captchaImage, img[id*=aptcha i], img[src*=aptcha i]";
const CAPTCHA_INPUT = "input#captchaText, input[name*=aptcha i]:not([type=hidden])";
const DOC_RX = /\.(pdf|xls|xlsx|doc|docx|zip|rar|dwg|jpg|jpeg)\b/i;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function rpc(fn, body) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_key: env.INGEST_KEY, ...body }),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const update = (job, o) => rpc("doc_job_update", { p_job: job.id, p_status: o.status ?? null, p_step: o.step ?? null, p_captcha_image: o.image ?? null, p_detail: o.detail ?? null, p_files: o.files ?? null, p_error: o.error ?? null });

const visible = async (page, sel) => { for (const h of await page.$$(sel)) if (await h.isVisible()) return h; return null; };
const hasCaptcha = async (page) => !!(await visible(page, CAPTCHA_IMG)) && !!(await visible(page, CAPTCHA_INPUT));

// Show the captcha picture in the assistant and wait for the person's answer; fill it and press the visible button.
async function captchaFromPerson(page, job) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const img = await visible(page, CAPTCHA_IMG), input = await visible(page, CAPTCHA_INPUT);
    if (!img || !input) return true;
    const png = await img.screenshot({ type: "png" });
    const r0 = await update(job, { status: "captcha", step: attempt === 1 ? "The portal asks for a captcha — type it below" : "The portal did not accept that; here is a new picture", image: `data:image/png;base64,${png.toString("base64")}` });
    const seq = r0.captcha_seq;
    const until = Date.now() + 9 * 60000;
    let answer = null;
    while (Date.now() < until) {
      await sleep(2000);
      const s = await rpc("doc_job_poll", { p_job: job.id });
      if (["cancelled", "failed", "collected"].includes(s.status)) throw new Error("stopped");
      if (s.captcha_answer && s.captcha_seq === seq) { answer = s.captcha_answer; break; }
    }
    if (!answer) throw new Error("Nobody typed the captcha in time");
    await input.fill(answer);
    const btn = await input.evaluateHandle((el) => {
      const f = el.closest("form") || document;
      const all = [...f.querySelectorAll("input[type=submit], button[type=submit], input[type=button][value*=Submit i], input#Search, input[name=Search], input[value*=Submit i], input[value*=Search i], input[value*=Download i]")];
      return all.find((b) => b.offsetParent !== null && getComputedStyle(b).visibility !== "hidden") || null;
    });
    const nav = page.waitForLoadState("domcontentloaded").catch(() => {});
    if (btn.asElement()) await btn.asElement().click(); else await input.press("Enter");
    await nav;
    await page.waitForTimeout(2000);
    if (!(await hasCaptcha(page))) return true;
  }
  throw new Error("The portal did not accept the captcha three times");
}

// Organisation list → this tender's organisation → the tender's row → its detail page.
async function openTender(page, site, job) {
  await page.goto(site.base + "?page=FrontEndTendersByOrganisation&service=page", { waitUntil: "domcontentloaded", timeout: 60000 });
  const orgs = await page.$$eval("table.list_table tr, table#table tr", (trs) => trs
    .map((tr) => ({ name: tr.cells[1]?.innerText.trim(), href: tr.querySelector("td a")?.getAttribute("href") })).filter((r) => r.href && r.name));
  const want = norm(job.authority);
  const ordered = [...orgs.filter((o) => norm(o.name) === want), ...orgs.filter((o) => norm(o.name) !== want && (norm(o.name).includes(want) || want.includes(norm(o.name))))];
  for (const o of ordered.length ? ordered : orgs) {
    await update(job, { step: `Looking in ${o.name}` });
    await page.goto(new URL(o.href, site.base + "/").toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    const href = await page.$$eval("table.list_table tr, table#table tr", (trs, ref) => {
      const row = trs.find((tr) => tr.cells[4]?.innerText.includes(ref));
      return row?.querySelector("td a")?.getAttribute("href") || null;
    }, job.tender_ref);
    if (href) {
      await page.goto(new URL(href, site.base + "/").toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      return true;
    }
    if (ordered.length && o === ordered.at(-1)) break;
  }
  return false;
}

// Everything worth reading on the detail page (value, EMD, dates, work description) for the assistant's brief.
async function readDetail(page) {
  const cells = await page.$$eval("table tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText)));
  const d = parseDetail(cells);
  const map = {};
  for (const r of cells) for (let i = 0; i + 1 < r.length; i += 2) map[r[i].replace(/\s+/g, " ").trim().toLowerCase()] = r[i + 1].replace(/\s+/g, " ").trim();
  const get = (...keys) => { for (const k of keys) for (const [mk, v] of Object.entries(map)) if (mk.startsWith(k) && v) return v.slice(0, 600); return null; };
  return {
    ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined)),
    work_description: get("work description", "title"), period_of_work: get("period of work"), bid_validity: get("bid validity"),
    tender_type: get("tender type"), form_of_contract: get("form of contract"), pincode: get("pincode"),
    nda_pre_qualification: get("pre qualification", "nda/ pre qualification"), independent_external_monitor: get("independent external monitor"),
    tender_inviting_authority: get("name"), address: get("address"),
  };
}

// Click each document link; a captcha on the way goes to the person. Returns [{name, data}].
async function downloadDocs(page, job) {
  // NIT documents (named links), work item documents (unnamed links; the name is in their table row) and
  // "Download as zip file". The zip holds them all, so it goes first: one captcha for every document.
  const linkList = async () => page.$$eval("a", (as, rx) => as.map((a, i) => {
    const row = (a.closest("tr")?.innerText || "").replace(/\s+/g, " ");
    const name = (a.innerText.trim().match(new RegExp(`[^\\s/]+${rx}`, "i")) || row.match(new RegExp(`[^\\s/]+${rx}`, "i")) || [])[0] || "";
    return { i, t: a.innerText.trim(), name, zip: /download as zip/i.test(a.innerText), id: a.id || "", href: a.getAttribute("href") || "" };
  }).filter((a) => a.zip || (a.name && /docDownoad|DirectLink/i.test(a.id + a.href) && !/view more|back/i.test(a.t))), DOC_RX.source);
  let links = await linkList();
  const zip = links.find((l) => l.zip);
  const singles = links.filter((l) => !l.zip && !/zip$/i.test(l.name));
  const plan = [...(zip ? [zip] : []), ...singles].slice(0, MAX_FILES);
  log(`  ${plan.length} document link(s): ${plan.map((l) => l.zip ? "[zip]" : l.name).join(", ")}`);
  const files = [];
  for (const [n, l] of plan.entries()) {
    if (!l.zip && files.some((f) => /\.zip$/i.test(f.name))) break; // the zip already has them all
    await update(job, { status: "running", step: l.zip ? "Downloading all documents (zip)" : `Downloading ${n + 1} of ${plan.length}: ${l.name.slice(0, 60)}` });
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const handle = (await page.$$("a"))[l.i];
      if (!handle) break;
      const dl = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);
      await handle.click().catch(() => {});
      // either the file comes, or the portal asks for a captcha first
      let got = null;
      const until = Date.now() + 25000;
      while (Date.now() < until) {
        got = await Promise.race([dl, sleep(800).then(() => undefined)]);
        if (got !== undefined) break;
        if (await hasCaptcha(page)) break;
      }
      if (got) {
        const p = await got.path();
        const data = p ? await readFile(p) : null;
        if (data && data.length <= MAX_BYTES) files.push({ name: got.suggestedFilename() || l.name || l.t, data });
        break;
      }
      if (await hasCaptcha(page)) {
        const dl2 = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
        await captchaFromPerson(page, job);
        const d2 = await Promise.race([dl2, sleep(6000).then(() => null)]);
        if (d2) {
          const p = await d2.path();
          const data = p ? await readFile(p) : null;
          if (data && data.length <= MAX_BYTES) files.push({ name: d2.suggestedFilename() || l.name || l.t, data });
          break;
        }
        // back on the detail page after the captcha: the link list may have moved
        links = await linkList();
        const again = links.find((x) => x.zip === l.zip && x.name === l.name && x.t === l.t);
        if (again) l.i = again.i; else break;
        continue;
      }
      break;
    }
  }
  // portals that only offer one zip: open it
  return files.flatMap((f) => /\.zip$/i.test(f.name) ? (() => { try { return unzip(f.data).filter((x) => DOC_RX.test(x.name)); } catch { return [f]; } })() : [f]).slice(0, 30);
}

async function upload(job, files) {
  const list = [];
  for (const [no, f] of files.entries()) {
    const chunks = Math.ceil(f.data.length / CHUNK) || 1;
    for (let s = 0; s < chunks; s++) await rpc("doc_job_put_chunk", { p_job: job.id, p_file_no: no, p_seq: s, p_b64: f.data.subarray(s * CHUNK, (s + 1) * CHUNK).toString("base64") });
    list.push({ no, name: String(f.name).replace(/[^\w.\- ()]/g, "_").slice(0, 150), size: f.data.length, chunks });
  }
  return list;
}

async function runJob(browser, job) {
  const site = GEPNIC.find((s) => s.portal === job.portal);
  if (!site || site.skip) { await update(job, { status: "failed", error: `Fetching documents from ${job.portal} is not supported yet. Download them from the portal and upload here.` }); return; }
  const ctx = await browser.newContext({ locale: "en-IN", acceptDownloads: true });
  const page = await ctx.newPage();
  try {
    log(`job ${job.id}: ${job.portal} ${job.tender_ref}`);
    if (!(await openTender(page, site, job))) {
      await update(job, { status: "failed", error: "This tender is no longer listed on the portal (it may have closed or been withdrawn)." });
      return;
    }
    if (await hasCaptcha(page)) await captchaFromPerson(page, job);
    await update(job, { step: "Reading the tender page", detail: await readDetail(page) });
    const files = await downloadDocs(page, job);
    if (!files.length) { await update(job, { status: "failed", error: "The portal did not give any documents. Download them from the portal and upload here." }); return; }
    await update(job, { step: `Handing over ${files.length} document${files.length === 1 ? "" : "s"}` });
    const list = await upload(job, files);
    await update(job, { status: "fetched", step: `Fetched ${list.length} document${list.length === 1 ? "" : "s"}`, files: list });
    log(`job ${job.id}: fetched ${list.length}`);
  } catch (e) {
    log(`job ${job.id} failed: ${e.message}`);
    await update(job, { status: "failed", error: e.message === "stopped" ? "Stopped." : e.message.split("\n")[0] }).catch(() => {});
  } finally {
    await ctx.close();
  }
}

const args = process.argv.slice(2);
const waitFirst = Number(args[args.indexOf("--wait") + 1]) || (args.includes("--wait") ? 90 : 0);
const browser = await chromium.launch();
try {
  const start = Date.now();
  let did = 0;
  for (;;) {
    const job = await rpc("doc_job_claim", { p_runner: RUNNER });
    if (job) { await runJob(browser, job); did++; continue; }
    if (!did && Date.now() - start < waitFirst * 1000) { await sleep(5000); continue; }
    if (args.includes("--forever")) { await sleep(10000); continue; }
    break;
  }
  log(`done: ${did} job(s)`);
} finally {
  await browser.close();
}
