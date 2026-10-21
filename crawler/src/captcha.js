// Captcha help from a person. When a portal page shows a captcha, the crawler sends the captcha picture to
// Dhandha (Admin → Crawler shows a "Captcha needed" card), waits for a platform admin to read it and type the
// answer, then fills that answer in and presses the portal's own Search button — as the person would.
// Nothing here reads or solves the picture; if nobody answers in time, the page is skipped for this run.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CAPTCHA_IMG = "img#captchaImage, img[id*=aptcha i], img[src*=aptcha i]";
const CAPTCHA_INPUT = "input#captchaText, input[name*=aptcha i]:not([type=hidden])";

export const hasCaptcha = async (page) => !!(await page.$(CAPTCHA_IMG)) && !!(await page.$(CAPTCHA_INPUT));

// Ask Dhandha and wait for the typed answer. Returns the answer, or null when skipped, expired or switched off.
export async function waitForAnswer(env, { runner, portal, purpose, image, log = console.log, fetchFn = fetch, pause = sleep, pollMs = 4000, onMissed = () => {} }) {
  const waitMin = Number(env.CAPTCHA_WAIT_MIN ?? 8);
  if (!waitMin || env.CAPTCHA_HELP === "off") return null;
  const rpc = async (fn, body) => {
    const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_key: env.INGEST_KEY, ...body }),
    });
    if (!r.ok) throw new Error(`${fn} ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  };
  const id = await rpc("captcha_ask", { p_runner: runner, p_portal: portal, p_purpose: purpose, p_image: image, p_wait_minutes: waitMin });
  log(`  ${portal}: captcha shown in Admin → Crawler, waiting up to ${waitMin} min for someone to type it`);
  const deadline = Date.now() + waitMin * 60000 + 30000;
  while (Date.now() < deadline) {
    await pause(pollMs);
    const r = await rpc("captcha_poll", { p_id: id });
    if (r.status === "answered") return r.answer;
    if (r.status !== "waiting") { log(`  ${portal}: captcha ${r.status}`); if (r.status === "expired") onMissed(); return null; }
  }
  onMissed();
  return null;
}

// Full round trip on a live page: picture → person → answer typed into the page → Search. Two tries at most
// (a new picture each time). Returns true once the page no longer asks for a captcha.
export async function solveWithPerson(page, env, { runner, portal, purpose, log = console.log, onWait = () => {}, onMissed }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const img = await page.$(CAPTCHA_IMG);
    const input = await page.$(CAPTCHA_INPUT);
    if (!img || !input) return true;
    const png = await img.screenshot({ type: "png" });
    onWait();
    const answer = await waitForAnswer(env, { runner, portal, purpose, image: `data:image/png;base64,${png.toString("base64")}`, log, onMissed });
    if (!answer) return false;
    await input.fill(answer);
    const submit = await input.evaluateHandle((el) => {
      const f = el.closest("form") || document;
      return f.querySelector("input#Search, input[name=Search], input[type=submit], button[type=submit], input[value*=Search i], input[value*=Submit i]");
    });
    if (submit.asElement()) await Promise.all([page.waitForLoadState("domcontentloaded").catch(() => {}), submit.asElement().click()]);
    else await Promise.all([page.waitForLoadState("domcontentloaded").catch(() => {}), input.press("Enter")]);
    await page.waitForTimeout(1500);
    if (!(await hasCaptcha(page)) || (await page.$("table.list_table tr td a, table#table tr td a"))) return true;
    log(`  ${portal}: the portal did not accept that captcha${attempt < 2 ? ", asking again" : ""}`);
  }
  return false;
}
