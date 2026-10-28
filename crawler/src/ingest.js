// Sends tenders to Dhandha (Supabase RPC ingest_tenders) in batches of 200. A batch the database times out on
// (busy while matching) is retried in smaller pieces after a pause; a piece that still fails is skipped and counted,
// so one bad batch no longer loses the rest of a portal.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// rows in batches of 200 through post(batch); a timed-out batch is retried in halves (up to 3 levels), the rest
// still go through. Throws only when every row failed.
async function sendInBatches(rows, post, keys, pause) {
  const totals = Object.fromEntries([...keys, "failed"].map((k) => [k, 0]));
  const add = (res) => { for (const k of keys) totals[k] += res?.[k] || 0; };
  let lastError = null;
  const send = async (batch, depth) => {
    try { add(await post(batch)); }
    catch (e) {
      if (!/57014|timeout|50[234]/.test(e.message) || depth >= 3) { totals.failed += batch.length; lastError = e; return; }
      await sleep(pause * (depth + 1));
      const half = Math.ceil(batch.length / 2);
      await send(batch.slice(0, half), depth + 1);
      if (batch.length > half) await send(batch.slice(half), depth + 1);
    }
  };
  for (let i = 0; i < rows.length; i += 200) await send(rows.slice(i, i + 200), 0);
  if (totals.failed && totals.failed === rows.length && lastError) throw lastError;
  if (!totals.failed) delete totals.failed;
  return totals;
}

export function sendTenders(source, rows, env = process.env, { post = postTenders, pause = 5000 } = {}) {
  return sendInBatches(rows, (batch) => post(source, batch, env), ["received", "inserted", "changed", "matched"], pause);
}

async function postTenders(source, batch, env) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_tenders`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_key: env.INGEST_KEY, p_source: source, p_rows: batch }),
  });
  if (!r.ok) throw new Error(`ingest ${r.status}: ${await r.text()}`);
  return r.json();
}

// Sends award-of-contract results (tender winners) to Dhandha (RPC ingest_awards), with the same batches and retries.
export function sendAwards(source, rows, env = process.env, { post = postAwards, pause = 5000 } = {}) {
  return sendInBatches(rows, (batch) => post(source, batch, env), ["received", "inserted"], pause);
}

async function postAwards(source, batch, env) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_awards`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_key: env.INGEST_KEY, p_source: source, p_rows: batch }),
  });
  if (!r.ok) throw new Error(`ingest awards ${r.status}: ${await r.text()}`);
  return r.json();
}
