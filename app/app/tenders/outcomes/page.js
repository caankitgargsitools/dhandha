import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import { outcomeStats, gapPct, STAGES } from "@/lib/outcomes";
import { PACKS } from "@/lib/leads";

export const metadata = { title: "Our bid results" };

function Table({ title, rows, label = (k) => k }) {
  if (!rows.length) return null;
  return (
    <div className="panel flush table-wrap">
      <h3 style={{ padding: "14px 16px 0" }}>{title}</h3>
      <table><thead><tr><th /><th>Bids</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key}><td className="small">{label(r.key)}</td><td>{r.bids}</td><td>{r.won}</td><td>{r.lost}</td><td className="small">{r.winRate === null ? "—" : `${r.winRate}%`}</td></tr>)}</tbody></table>
    </div>
  );
}

export default async function Outcomes() {
  const { supabase, company } = await getContext();
  const { data, error } = await supabase.rpc("bid_outcomes", { p_company: company.id });
  const rows = data || [];
  const s = outcomeStats(rows);
  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Our bid results</h1><p>Every bid you filed and what happened — where you win, why you lose and how far you were from L1. Record a result on the tender page after the bids open.</p></div></div>
      {error && <p className="error">{error.message}</p>}
      <div className="grid-3">
        <div className="panel"><div className="tiny faint">Win rate</div><div style={{ fontSize: 26, fontWeight: 700 }}>{s.winRate === null ? "—" : `${s.winRate}%`}</div><div className="tiny faint">{s.won} won of {s.decided} decided · {s.bids - s.decided} waiting</div></div>
        <div className="panel"><div className="tiny faint">Disqualified</div><div style={{ fontSize: 26, fontWeight: 700 }}>{s.disqualified}</div><div className="tiny faint">{s.reasons.map((r) => `${r.reason} (${r.n})`).join(" · ") || "No reasons recorded"}</div></div>
        <div className="panel"><div className="tiny faint">Lost on price</div><div style={{ fontSize: 26, fontWeight: 700 }}>{s.lostOnPrice}</div><div className="tiny faint">{s.medianGap !== null ? `Usually ${s.medianGap}% above L1` : "Record L1 prices to see the gap"}</div></div>
      </div>
      <div className="grid-3">
        <Table title="By department" rows={s.byAuthority} />
        <Table title="By state" rows={s.byState} />
        <Table title="By kind of work" rows={s.byPack} label={(k) => PACKS[k] || k} />
      </div>
      <div className="panel flush table-wrap">
        <h3 style={{ padding: "14px 16px 0" }}>Bids</h3>
        <table>
          <thead><tr><th>Tender</th><th>Result</th><th>Rank</th><th>Our price</th><th>L1</th></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={5} className="muted small">No bids filed yet. Mark a tender &ldquo;Submitted&rdquo; and record its result after opening.</td></tr>}
            {rows.map((r) => { const g = gapPct(r.quoted_price, r.l1_price); return (
              <tr key={r.match_id}>
                <td className="small"><Link href={`/app/tenders/${r.match_id}`}>{r.title?.slice(0, 90)}</Link><div className="tiny faint">{r.authority} · {fmtDate(r.due_at)}</div></td>
                <td className="small"><span className={`chip ${r.status === "won" ? "ok" : r.status === "lost" ? "bad" : "info"}`}>{r.status === "won" ? "Won" : r.status === "lost" ? "Lost" : "Waiting"}</span>{r.result_stage && <div className="tiny faint">{STAGES[r.result_stage]}{r.result_reason ? ` — ${r.result_reason}` : ""}</div>}</td>
                <td className="small">{r.our_rank ? `L${r.our_rank}${r.bidders ? ` of ${r.bidders}` : ""}` : "—"}</td>
                <td className="num small">{r.quoted_price ? lakh(r.quoted_price) : "—"}</td>
                <td className="num small">{r.l1_price ? lakh(r.l1_price) : "—"}{g !== null && g > 0 && <div className="tiny faint">we were {g}% higher</div>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
