import { getAdminContext } from "@/lib/admin";
import { aiTiers } from "@/lib/ai";
import { ago } from "@/lib/tickets";
import { StageBars } from "@/components/Charts";

const USD_INR = 84;

export default async function AdminAi() {
  const { supabase } = await getAdminContext();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: rows } = await supabase.from("ai_usage").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
  const tiers = aiTiers();
  const usage = rows || [];
  const byModel = Object.values(usage.reduce((m, r) => {
    const k = r.model; m[k] = m[k] || { model: k, provider: r.provider, calls: 0, ok: 0, cost: 0, tokens: 0 };
    m[k].calls++; if (r.ok) m[k].ok++; m[k].cost += Number(r.cost_usd); m[k].tokens += r.input_tokens + r.output_tokens; return m;
  }, {}));
  const total = usage.reduce((s, r) => s + Number(r.cost_usd), 0);
  const freeShare = usage.length ? Math.round((usage.filter((r) => r.ok && Number(r.cost_usd) === 0).length / Math.max(1, usage.filter((r) => r.ok).length)) * 100) : 0;
  const ALL = [
    ["Free reader (rules)", "Built in, always on", true, "Typed English tenders: value, EMD, eligibility, documents, formats, dates"],
    ["Gemini Flash free tier", "GEMINI_API_KEY", !!process.env.GEMINI_API_KEY, "Public tender documents only (free tier may train on inputs)"],
    ["Claude Haiku", "ANTHROPIC_API_KEY", !!process.env.ANTHROPIC_API_KEY, "$1 / $5 per million tokens in / out; private data allowed"],
    ["Claude Sonnet", "ANTHROPIC_API_KEY", !!process.env.ANTHROPIC_API_KEY, "$2 / $10 per million tokens; only when cheaper engines fail"],
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>AI engines</h1><p>Every AI task tries the free engine first, then the cheaper paid one, then the stronger one — only moving up when the cheaper one fails.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">AI spend, 30 days</div><div className="kpi">${total.toFixed(2)}</div><div className="faint small">about ₹{Math.round(total * USD_INR).toLocaleString("en-IN")}</div></div>
        <div className="panel ledger"><div className="kpi-label">AI calls</div><div className="kpi">{usage.length}</div><div className="faint small">{usage.filter((r) => !r.ok).length} failed and moved up a tier</div></div>
        <div className="panel ledger"><div className="kpi-label">Done for free</div><div className="kpi">{freeShare}%</div><div className="faint small">of successful AI calls</div></div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h3>Order of engines</h3>
          <ol className="stack-sm" style={{ paddingLeft: 18, margin: 0 }}>
            {ALL.map(([name, key, on, note]) => (
              <li key={name}><div className="row between" style={{ flexWrap: "nowrap" }}><strong>{name}</strong><span className={`chip ${on ? "ok" : "mute"}`}>{on ? "On" : "Not set up"}</span></div>
                <div className="tiny faint">{note}{!on && key.includes("_KEY") ? ` — add ${key} in Vercel → Settings → Environment Variables` : ""}</div></li>
            ))}
          </ol>
          <p className="tiny faint" style={{ marginBottom: 0 }}>Active order now: {tiers.length ? ["rules", ...tiers.map((t) => t.id)].join(" → ") : "rules only"}</p>
        </div>
        <div className="panel">
          <h3>Spend by engine</h3>
          {byModel.length ? <StageBars rows={byModel.map((b) => ({ label: b.model.replace(/-\d{8}$/, "").slice(0, 14), value: Number(b.cost.toFixed(4)) }))} format={(v) => `$${v.toFixed(2)}`} /> : <p className="muted small">No AI calls yet.</p>}
        </div>
      </div>
      <div className="panel flush table-wrap">
        <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Recent calls</h3></div>
        <table>
          <thead><tr><th>When</th><th>Task</th><th>Engine</th><th className="right">Tokens</th><th className="right">Cost</th><th>Result</th></tr></thead>
          <tbody>
            {usage.slice(0, 50).map((r) => (
              <tr key={r.id}><td className="small faint">{ago(r.created_at)}</td><td className="small">{r.task}</td><td className="small">{r.model}</td>
                <td className="right num small">{(r.input_tokens + r.output_tokens).toLocaleString("en-IN")}</td><td className="right num small">${Number(r.cost_usd).toFixed(4)}</td>
                <td>{r.ok ? <span className="chip ok">OK</span> : <span className="chip warn" title={r.note || ""}>Moved up</span>}</td></tr>
            ))}
            {!usage.length && <tr><td colSpan={6} className="muted small">No AI calls yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
