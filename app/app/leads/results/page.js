import Link from "next/link";
import { getContext, lakh } from "@/lib/session";
import { SOURCES } from "@/lib/leads";

const PERIODS = [["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"], ["all", "All time"]];
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Results by lead source: how many leads each source gave, what they cost, and the business they closed — so the
// user can put the budget where it pays.
export default async function SourceResults({ searchParams }) {
  const sp = await searchParams;
  const period = PERIODS.some(([k]) => k === sp?.p) ? sp.p : "90";
  const since = period === "all" ? null : new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10);
  const { supabase, company } = await getContext();
  const { data } = await supabase.rpc("source_results", { p_company: company.id, p_since: since });
  const rows = (data || []).map((r) => ({ ...r, leads: Number(r.leads), cost: Number(r.cost), won: Number(r.won), won_value: Number(r.won_value), meetings: Number(r.meetings), open_value: Number(r.open_value) }))
    .sort((a, b) => b.won_value - a.won_value || b.leads - a.leads);
  const t = rows.reduce((s, r) => ({ leads: s.leads + r.leads, cost: s.cost + r.cost, won: s.won + r.won, won_value: s.won_value + r.won_value, meetings: s.meetings + r.meetings }), { leads: 0, cost: 0, won: 0, won_value: 0, meetings: 0 });
  const best = rows.filter((r) => r.won_value > 0).sort((a, b) => b.won_value / Math.max(b.cost, 1) - a.won_value / Math.max(a.cost, 1))[0];
  const max = Math.max(1, ...rows.map((r) => r.won_value));
  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head">
        <div><h1>Results by source</h1><p>Leads, cost and business closed from each source — put your budget where it pays.</p></div>
        <div className="row" style={{ gap: 6 }}>{PERIODS.map(([k, l]) => <Link key={k} href={`?p=${k}`} className={`btn sm ${k === period ? "" : "ghost"}`}>{l}</Link>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
        {[["Leads", t.leads.toLocaleString("en-IN")], ["Spent", inr(t.cost)], ["Meetings", t.meetings], ["Deals won", t.won], ["Business closed", lakh(t.won_value)], ["Return on spend", t.cost ? `${Math.round(t.won_value / t.cost).toLocaleString("en-IN")}×` : "—"]].map(([k, v]) => (
          <div key={k} className="panel" style={{ padding: 14 }}><div className="tiny faint">{k}</div><div style={{ fontSize: 22, fontWeight: 700 }} className="num">{v}</div></div>
        ))}
      </div>
      {best && <div className="notice info"><span><strong>{SOURCES[best.source] || best.source}</strong> pays best: {lakh(best.won_value)} closed for {inr(best.cost)} spent. Consider giving it more of the autopilot budget.</span></div>}
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Spent</th><th className="num">Per lead</th><th className="num">Meetings</th><th className="num">Won</th><th className="num">Win rate</th><th className="num">Business closed</th><th className="num">Cost per win</th><th className="num">In pipeline</th></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={10} className="muted small">No leads in this period yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.source}>
                <td><strong>{SOURCES[r.source] || r.source}</strong><div className="bar" style={{ marginTop: 4 }}><span style={{ width: `${(r.won_value / max) * 100}%` }} /></div></td>
                <td className="num">{r.leads}</td><td className="num">{inr(r.cost)}</td><td className="num">{r.leads ? inr(r.cost / r.leads) : "—"}</td>
                <td className="num">{r.meetings}</td><td className="num">{r.won}</td><td className="num">{r.leads ? `${Math.round((r.won / r.leads) * 1000) / 10}%` : "—"}</td>
                <td className="num"><strong>{lakh(r.won_value)}</strong></td><td className="num">{r.won ? inr(r.cost / r.won) : "—"}</td><td className="num">{lakh(r.open_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Spent = credits for finding each lead plus the emails, WhatsApp messages and AI calls sent to it. Business closed = value of deals marked Won (enter the value on the deal). Leads are counted in the period they were added.</p>
    </div>
  );
}
