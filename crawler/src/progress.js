// Live progress for Admin → Crawler: which step is running, how far it got, what is queued.
// Posts at most every 5 seconds (and at every step change) through crawler_progress with the ingest key.
export function createProgress(env, steps, { runner = env.RUNNER_NAME || "crawler", log = console.log } = {}) {
  const state = {
    run_id: `${Date.now().toString(36)}`, runner, started_at: new Date().toISOString(),
    where: env.RUNNER_WHERE || null, link: env.RUNNER_LINK || null, concurrency: Number(env.CONCURRENCY || 2),
    steps: steps.map((s) => ({ step: s, status: "queued" })),
  };
  let last = 0, timer = null, chain = Promise.resolve();
  const post = (status, done) => {
    chain = chain.then(async () => {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/crawler_progress`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
          body: JSON.stringify({ p_key: env.INGEST_KEY, p_runner: runner, p_status: status, p_state: state, p_done: done || null }),
        });
        if (!r.ok) log("progress post failed", r.status, (await r.text()).slice(0, 200));
      } catch (e) { log("progress post failed", e.message); }
    });
    return chain;
  };
  const find = (step) => state.steps.find((s) => s.step === step);
  const soon = () => {
    if (timer) return;
    const wait = Math.max(0, 5000 - (Date.now() - last));
    timer = setTimeout(() => { timer = null; last = Date.now(); post("running"); }, wait);
  };
  return {
    state,
    start: () => { last = Date.now(); return post("running"); },
    begin(step) { Object.assign(find(step), { status: "running", started_at: new Date().toISOString(), phase: "starting" }); last = Date.now(); return post("running"); },
    // phase: "listing" (page n of m) or "details" (done of total)
    update(step, info) { Object.assign(find(step), info); soon(); },
    end(step, { items = 0, note = null, error = null } = {}) {
      const s = find(step);
      const seconds = s.started_at ? Math.round((Date.now() - Date.parse(s.started_at)) / 1000) : null;
      Object.assign(s, { status: error ? "failed" : "done", seconds, items, note, error, phase: null, done: undefined, total: undefined, page: undefined, of: undefined });
      last = Date.now();
      return post("running", { step, seconds, items, error });
    },
    skip(step, note) { Object.assign(find(step), { status: "skipped", note }); soon(); },
    finish(ok = true) { if (timer) clearTimeout(timer); state.finished_at = new Date().toISOString(); return post(ok ? "finished" : "failed"); },
  };
}

// Runs async jobs with a fixed number at a time.
export async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.max(1, size) }, async () => { while (queue.length) await fn(queue.shift()); }));
}

// Different portals go first on different runs, so a time budget still covers all of them over a day.
export function rotate(list, offset) {
  if (!list.length) return list;
  const k = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}
