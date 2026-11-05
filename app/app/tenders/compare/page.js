import Link from "next/link";
import { getContext, lakh, fmtDate, daysLeft } from "@/lib/session";
import { mandatoryUnmet } from "@/lib/conditions";
import { bidChance } from "@/lib/bidChance";
import { goNoGo } from "@/lib/goNoGo";
import { ScoreRing } from "@/components/Charts";

export const metadata = { title: "Compare tenders" };

// Compare 2–4 tenders side by side with a go / no-go suggestion each (brief §3.7)
export default async function Compare({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company } = await getContext();
  const raw = [].concat(sp?.pick || [], String(sp?.ids || "").split(","));
  const picked = [...new Set(raw.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 4);
  const [{ data: pool }, { data: outcomes }] = await Promise.all([
    supabase.from("tender_matches").select("id, score, status, eligible, pending, reasons, tenders(title, authority, state, value_inr, emd_inr, due_at, industry_pack, kind, department)")
      .eq("company_id", company.id).in("status", ["new", "shortlisted", "preparing"]).order("score", { ascending: false }).limit(80),
    supabase.rpc("bid_outcomes", { p_company: company.id }),
  ]);
  const open = (pool || []).filter((m) => m.tenders && daysLeft(m.tenders.due_at) >= 0);
  const rows = picked.map((id) => open.find((m) => m.id === id)).filter(Boolean).map((m) => {
    const t = m.tenders, chance = bidChance(outcomes || [], t);
    const g = goNoGo({ score: m.score, unmet: mandatoryUnmet(m.reasons).length, pending: m.pending || 0, daysLeft: daysLeft(t.due_at), chance: chance.p, emd: t.emd_inr, value: t.value_inr });
    return { m, t, g, chance };
  });
  const cell = { padding: "8px 10px", verticalAlign: "top" };
  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Compare tenders</h1><p>Pick up to four open tenders to see them side by side, with a plain go / no-go suggestion from your fit score, conditions, time left and your record on similar bids.</p></div></div>
      <form className="panel stack-sm" method="get">
        <div className="small muted">Your open matches (best first) — tick 2 to 4:</div>
        <div className="compare-pick">
          {open.slice(0, 40).map((m) => (
            <label key={m.id} className="small row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <input type="checkbox" name="pick" value={m.id} defaultChecked={picked.includes(m.id)} />
              <span>{String(m.tenders.title).slice(0, 90)} <span className="faint">· {m.score}</span></span>
            </label>
          ))}
        </div>
        <div><button className="sm">Compare</button></div>
      </form>
      {rows.length > 0 && (
        <div className="panel flush table-wrap">
          <table className="compare-table">
            <thead><tr><th style={cell}></th>{rows.map(({ m, t }) => <th key={m.id} style={cell}><Link href={`/app/tenders/${m.id}`}>{String(t.title).slice(0, 80)}</Link></th>)}</tr></thead>
            <tbody>
              <tr><td style={cell} className="small muted">Suggestion</td>{rows.map(({ m, g }) => <td key={m.id} style={cell}><span className={`chip ${g.tone}`}>{g.label}</span>{g.why.length > 0 && <div className="tiny faint" style={{ marginTop: 4 }}>{g.why.join("; ")}</div>}</td>)}</tr>
              <tr><td style={cell} className="small muted">Fit score</td>{rows.map(({ m }) => <td key={m.id} style={cell}><ScoreRing score={m.score} size={40} /></td>)}</tr>
              <tr><td style={cell} className="small muted">Buyer</td>{rows.map(({ m, t }) => <td key={m.id} style={cell} className="small">{[t.authority, t.state].filter(Boolean).join(", ")}</td>)}</tr>
              <tr><td style={cell} className="small muted">Value · EMD</td>{rows.map(({ m, t }) => <td key={m.id} style={cell} className="small">{t.value_inr ? lakh(t.value_inr) : "—"} · {t.emd_inr ? lakh(t.emd_inr) : "Nil"}</td>)}</tr>
              <tr><td style={cell} className="small muted">Closes</td>{rows.map(({ m, t }) => <td key={m.id} style={cell} className="small">{t.due_at ? `${fmtDate(t.due_at)} · ${daysLeft(t.due_at)} d` : "—"}</td>)}</tr>
              <tr><td style={cell} className="small muted">Eligibility</td>{rows.map(({ m }) => { const u = mandatoryUnmet(m.reasons).length; return <td key={m.id} style={cell} className="small">{u ? `${u} mandatory not met` : m.pending ? `${m.pending} question(s) open` : "Qualified"}</td>; })}</tr>
              <tr><td style={cell} className="small muted">Your record</td>{rows.map(({ m, chance }) => <td key={m.id} style={cell} className="small">{chance.decided ? `${chance.won} won of ${chance.decided} decided${chance.p != null ? ` · ${chance.p}% chance` : ""}` : "No results yet"}</td>)}</tr>
              <tr><td style={cell} className="small muted">Stage</td>{rows.map(({ m }) => <td key={m.id} style={cell} className="small">{m.status}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
