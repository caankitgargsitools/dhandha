// Sends tenders to Dhandha (Supabase RPC ingest_tenders) in batches of 200.
export async function sendTenders(source, rows, env = process.env) {
  const totals = { received: 0, inserted: 0, changed: 0, matched: 0 };
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_tenders`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_key: env.INGEST_KEY, p_source: source, p_rows: batch }),
    });
    if (!r.ok) throw new Error(`ingest ${r.status}: ${await r.text()}`);
    const res = await r.json();
    for (const k of Object.keys(totals)) totals[k] += res[k] || 0;
  }
  return totals;
}
