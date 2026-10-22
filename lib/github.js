import "server-only";

// Starts the "tender docs" GitHub Actions workflow so a queued document job is picked up within a minute.
// Needs GITHUB_DISPATCH_TOKEN in Vercel (a fine-grained token with Actions: read and write on this repository).
// Without it, queued jobs are picked up by the next scheduled crawler run.
export async function startDocFetcher() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ok: false, reason: "not_configured" };
  const repo = process.env.GITHUB_REPOSITORY || "caankitgargsitools/dhandha";
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/tender-docs.yml/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { probe: "false" } }),
    signal: AbortSignal.timeout(10000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  if (!r.ok) return { ok: false, reason: `github ${r.status}: ${(await r.text()).slice(0, 120)}` };
  return { ok: true };
}
