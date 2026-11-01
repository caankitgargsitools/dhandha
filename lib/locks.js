import "server-only";

// One paid step at a time per company and tender: a second click or a retried request gets a friendly answer
// instead of a second charge. The lock lapses by itself (seconds), so a request the platform cut off frees it.
export async function withLock(supabase, { company, action, ref, seconds = 300 }, fn) {
  const lock = { p_company: company, p_action: action, p_ref: String(ref || "") };
  const { data: got } = await supabase.rpc("action_lock", { ...lock, p_seconds: seconds });
  if (!got) return { error: `This is already running (started a moment ago). If nothing appears within ${Math.ceil(seconds / 60)} minutes, try again — you will not be charged twice.` };
  try { return await fn(); } finally { await supabase.rpc("action_unlock", lock); }
}
