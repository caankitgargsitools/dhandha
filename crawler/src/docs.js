// Tender document fetcher. The tender assistant in Dhandha queues a job; this worker claims it, finds the tender
// on its GePNIC portal (organisation list → organisation → tender), reads the detail page, and downloads the
// tender documents. Where the portal asks for a captcha, the picture goes to Dhandha's platform admins (captcha desk
// and a phone notification) and a person types it; nothing reads or solves captchas here. Shortlisted and strongly
// matching tenders are queued in advance (auto jobs). Files go back to Dhandha in chunks (doc_job_put_chunk).
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
const MAX_FILES = 15, MAX_BYTES = 25 * 1024 * 1024, CHUNK = 512 * 1024; // 512 KB pieces keep each database write well inside its time limit
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

// Where a captcha picture goes and its answer comes from: a document job (captcha desk) or a portal's captcha
// session (Admin → Captcha session). A person types it; nothing here reads or solves it.
const jobChannel = (job) => ({
  post: async (step, image) => (await update(job, { status: "captcha", step, image })).captcha_seq,
  poll: async () => { const s = await rpc("doc_job_poll", { p_job: job.id }); return { stop: ["cancelled", "failed", "collected"].includes(s.status), answer: s.captcha_answer, seq: s.captcha_seq }; },
  accepted: () => { job.asked = true; },
});
const sessionChannel = (portal) => ({
  post: async (step, image) => (await rpc("session_update", { p_portal: portal, p_state: "captcha", p_step: step, p_image: image })).captcha_seq,
  poll: async () => { const s = await rpc("session_poll", { p_portal: portal }); return { stop: s.state !== "captcha", answer: s.captcha_answer, seq: s.captcha_seq }; },
  accepted: () => {},
});

// Show the captcha picture to a person and wait for the answer; fill it and press the visible button.
async function captchaFromPerson(page, job, channel = jobChannel(job)) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const img = await visible(page, CAPTCHA_IMG), input = await visible(page, CAPTCHA_INPUT);
    if (!img || !input) return true;
    const png = await img.screenshot({ type: "png" });
    const seq = await channel.post(attempt === 1 ? "The portal asked for a captcha; waiting for it to be typed" : "The portal did not accept that; a new picture is waiting", `data:image/png;base64,${png.toString("base64")}`);
    const until = Date.now() + 9 * 60000;
    let answer = null;
    while (Date.now() < until) {
      await sleep(2000);
      const s = await channel.poll();
      if (s.stop) throw new Error("stopped");
      if (s.answer && s.seq === seq) { answer = s.answer; break; }
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
    if (!(await hasCaptcha(page))) { channel.accepted(); return true; }
  }
  throw new Error("The portal did not accept the captcha three times");
}

// Organisation list → this tender's organisation → the tender's row → its detail page.
async function openTender(page, site, job, say = (step) => update(job, { step })) {
  await page.goto(site.base + "?page=FrontEndTendersByOrganisation&service=page", { waitUntil: "domcontentloaded", timeout: 60000 });
  const orgs = await page.$$eval("table.list_table tr, table#table tr", (trs) => trs
    .map((tr) => ({ name: tr.cells[1]?.innerText.trim(), href: tr.querySelector("td a")?.getAttribute("href") })).filter((r) => r.href && r.name));
  const want = norm(job.authority);
  const ordered = [...orgs.filter((o) => norm(o.name) === want), ...orgs.filter((o) => norm(o.name) !== want && (norm(o.name).includes(want) || want.includes(norm(o.name))))];
  for (const o of ordered.length ? ordered : orgs) {
    await say(`Looking in ${o.name}`);
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
  // a zip is opened straight away, so the separate links below can skip what it already held
  const add = (name, data) => {
    if (!data || data.length > MAX_BYTES) return;
    if (/\.zip$/i.test(name) || data.subarray(0, 2).toString() === "PK" && !/\.(xlsx|docx)$/i.test(name)) {
      try { for (const x of unzip(data)) if (DOC_RX.test(x.name) && !/\.zip$/i.test(x.name)) files.push({ name: x.name, data: x.data }); return; } catch {}
    }
    files.push({ name, data });
  };
  const seen = new Set();
  for (const [n, l] of plan.entries()) {
    if (!l.zip && (seen.has(l.name) || files.some((f) => f.name === l.name))) continue;
    seen.add(l.name);
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
        add(got.suggestedFilename() || l.name || l.t, data);
        break;
      }
      if (await hasCaptcha(page)) {
        const dl2 = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
        await captchaFromPerson(page, job);
        const d2 = await Promise.race([dl2, sleep(6000).then(() => null)]);
        if (d2) {
          const p = await d2.path();
          const data = p ? await readFile(p) : null;
          add(d2.suggestedFilename() || l.name || l.t, data);
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
  log(`  got: ${files.map((f) => f.name).join(", ")}`);
  return files.slice(0, 30);
}

async function upload(job, files) {
  const list = [];
  for (const [no, f] of files.entries()) {
    const chunks = Math.ceil(f.data.length / CHUNK) || 1;
    for (let s = 0; s < chunks; s++) {
      const body = { p_job: job.id, p_file_no: no, p_seq: s, p_b64: f.data.subarray(s * CHUNK, (s + 1) * CHUNK).toString("base64") };
      // a busy database can time out one write: try each piece up to five times, waiting longer each time
      for (let tryNo = 1; ; tryNo++) {
        try { await rpc("doc_job_put_chunk", body); break; } catch (e) { if (tryNo >= 5) throw e; await sleep(3000 * tryNo); }
      }
    }
    list.push({ no, name: String(f.name).replace(/[^\w.\- ()]/g, "_").slice(0, 150), size: f.data.length, chunks });
  }
  return list;
}

// One browser session per portal, kept between jobs: after a person has typed a captcha, the portal often lets the
// same session download the next tenders without asking again. Where it does ask, the person is asked as usual.
// Idle sessions are kept alive (the portal's home page every few minutes, like an open browser tab) for 45 minutes,
// and the twice-daily pre-check batch runs portal by portal, so one typed captcha serves a run of tenders.
// A session opened by the admin's captcha session (or by a captcha typed in a fetch) is kept for the whole day; its
// cookies are saved so the next worker run carries on with it. How long each portal really keeps a session is
// learned from when it asks again or says the session ended (session_event → portal_session_log).
const SESSION_IDLE_MS = 45 * 60000, LIVE_IDLE_MS = 24 * 3600000;
const KEEPALIVE_MS = 4 * 60000;
const EXPIRED_RX = /session\s+(?:has\s+)?(?:expired|timed?\s*out)|session\s+time\s*out|invalid\s+session/i;
const sessions = new Map(); // portal -> { ctx, page, last, live }
const event = (portal, e, cookies = null) => rpc("session_event", { p_portal: portal, p_event: e, p_runner: RUNNER, p_cookies: cookies }).catch((x) => log("session_event", x.message));
const saveCookies = async (portal, s) => event(portal, "cookies", await s.ctx.cookies().catch(() => null));
async function sessionFor(browser, portal) {
  for (const [p, s] of sessions) {
    if (Date.now() - s.last > (s.live ? LIVE_IDLE_MS : SESSION_IDLE_MS)) {
      if (s.live) await event(p, "closed");
      await s.ctx.close().catch(() => {}); sessions.delete(p);
    }
  }
  let s = sessions.get(portal);
  if (!s || s.page.isClosed()) {
    const ctx = await browser.newContext({ locale: "en-IN", acceptDownloads: true });
    // carry on with a session a previous worker run kept alive
    const cookies = await rpc("session_cookies", { p_portal: portal }).catch(() => null);
    if (Array.isArray(cookies) && cookies.length) await ctx.addCookies(cookies).catch(() => {});
    s = { ctx, page: await ctx.newPage(), last: Date.now(), live: Array.isArray(cookies) && cookies.length > 0 };
    sessions.set(portal, s);
  }
  s.last = Date.now();
  return s;
}

// Admin → Captcha session: open the portal, go where it asks for a captcha (a tender's page and its documents),
// let the admin type it, and keep the session. Where the portal asks nothing, the session is simply live.
async function openSession(browser, req) {
  const portal = req.portal;
  const site = GEPNIC.find((x) => x.portal === portal);
  const say = (step) => rpc("session_update", { p_portal: portal, p_step: step }).catch(() => {});
  if (!site || site.skip) { await rpc("session_update", { p_portal: portal, p_state: "failed", p_error: "Documents are not fetched from this portal yet" }); return; }
  await dropSession(portal);
  const s = await sessionFor(browser, portal);
  s.live = false;
  const ch = sessionChannel(portal);
  let asked = false;
  try {
    log(`session ${portal}`);
    if (req.tender_ref && await openTender(s.page, site, { tender_ref: req.tender_ref, authority: req.authority }, say)) {
      if (await hasCaptcha(s.page)) { await captchaFromPerson(s.page, null, ch); asked = true; }
      // the documents usually ask for the captcha: click the first one (the file itself is not kept)
      const link = (await s.page.$$("a")).length ? await s.page.$("a[id*=docDownoad], a[id*=DirectLink], a:has-text('Download as zip')") : null;
      if (link) {
        await say("Checking the documents page");
        const dl = s.page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
        await link.click().catch(() => {});
        const until = Date.now() + 20000;
        while (Date.now() < until && !(await hasCaptcha(s.page))) { if (await Promise.race([dl, sleep(800).then(() => undefined)]) !== undefined) break; }
        if (await hasCaptcha(s.page)) { await captchaFromPerson(s.page, null, ch); asked = true; }
      }
    } else {
      await s.page.goto(site.base, { timeout: 60000, waitUntil: "domcontentloaded" });
      if (await hasCaptcha(s.page)) { await captchaFromPerson(s.page, null, ch); asked = true; }
    }
    await rpc("session_update", { p_portal: portal, p_state: "live", p_step: asked ? "Live — fetches go through without a captcha while the portal keeps the session" : "Live — the portal did not ask for a captcha" });
    s.live = true;
    await saveCookies(portal, s);
  } catch (e) {
    log(`session ${portal} failed: ${e.message}`);
    await rpc("session_update", { p_portal: portal, p_state: "failed", p_error: e.message === "stopped" ? "Stopped." : e.message.split("\n")[0] }).catch(() => {});
    await dropSession(portal);
  }
}
async function keepAlive() {
  for (const [portal, s] of sessions) {
    if (Date.now() - (s.touched || s.last) < KEEPALIVE_MS || s.page.isClosed()) continue;
    s.touched = Date.now();
    const site = GEPNIC.find((x) => x.portal === portal);
    if (site) await s.page.goto(site.base, { timeout: 30000, waitUntil: "domcontentloaded" }).catch(() => {});
    // the portal says the session ended: learn how long it lasted and tell the admin
    const text = await s.page.evaluate(() => document.body?.innerText.slice(0, 4000) || "").catch(() => "");
    if (s.live && EXPIRED_RX.test(text)) { await event(portal, "expired"); await dropSession(portal); }
  }
}
async function dropSession(portal) { const s = sessions.get(portal); if (s) { sessions.delete(portal); await s.ctx.close().catch(() => {}); } }

async function runJob(browser, job) {
  const site = GEPNIC.find((s) => s.portal === job.portal);
  if (!site || site.skip) { await update(job, { status: "failed", error: `Fetching documents from ${job.portal} is not supported yet. Download them from the portal and upload here.` }); return; }
  const sess = await sessionFor(browser, job.portal);
  const { page } = sess;
  let broken = false;
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
    // learning: a captcha on a live session means the portal ended it; none means the session carried this fetch
    if (job.asked) { await event(job.portal, sess.live ? "captcha_again" : "captcha_ok"); sess.live = true; await saveCookies(job.portal, sess); }
    else if (sess.live) await event(job.portal, "served");
  } catch (e) {
    broken = true;
    log(`job ${job.id} failed: ${e.message}`);
    await update(job, { status: "failed", error: e.message === "stopped" ? "Stopped." : e.message.split("\n")[0] }).catch(() => {});
  } finally {
    if (broken) await dropSession(job.portal); else if (sessions.get(job.portal)) sessions.get(job.portal).last = Date.now();
  }
}

const args = process.argv.slice(2);
const waitFirst = Number(args[args.indexOf("--wait") + 1]) || (args.includes("--wait") ? 90 : 0);
// --forever --hours 5.75: keep watching for jobs (checks every 3 s), then exit so the next run takes over
const stopAt = args.includes("--hours") ? Date.now() + Number(args[args.indexOf("--hours") + 1]) * 3600000 : Infinity;
const browser = await chromium.launch();
try {
  const start = Date.now();
  let did = 0, lastPortal = null, lastSessionCheck = 0;
  for (;;) {
    // the admin's captcha session comes first: open each portal that was asked for
    if (Date.now() - lastSessionCheck > 10000) {
      lastSessionCheck = Date.now();
      const req = await rpc("session_claim", { p_runner: RUNNER }).catch((e) => { log("session_claim", e.message); return null; });
      if (req) { await openSession(browser, req); lastSessionCheck = 0; continue; }
    }
    // jobs people wait for come first; otherwise stay on the portal whose session is already open
    const job = await rpc("doc_job_claim", { p_runner: RUNNER, p_portal: lastPortal });
    if (job) { await runJob(browser, job); did++; lastPortal = job.portal; continue; }
    if (!did && Date.now() - start < waitFirst * 1000) { await sleep(5000); continue; }
    if (args.includes("--forever") && Date.now() < stopAt) { await keepAlive(); await sleep(3000); continue; }
    break;
  }
  log(`done: ${did} job(s)`);
} finally {
  await browser.close();
}
