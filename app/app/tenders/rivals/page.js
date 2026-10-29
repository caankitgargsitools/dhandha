import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import { followRival, stopRival } from "./actions";

export const metadata = { title: "Rivals" };

// Rival tracking (PENDING 28): follow the firms you bid against; their wins come from award results our crawler reads,
// with a phone alert each time a followed rival wins.
export default async function Rivals() {
  const { supabase, company, role } = await getContext();
  const [{ data: rivals, error }, { data: sugg }] = await Promise.all([
    supabase.rpc("rival_view", { p_company: company.id }),
    supabase.rpc("rival_suggestions", { p_company: company.id }),
  ]);
  const canEdit = !["viewer", "telecaller", "field"].includes(role);
  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Rivals</h1><p>Follow the firms you bid against: what they won, for whom, for how much and how far below the estimate. Your phone buzzes when a followed rival wins a new contract. Free.</p></div>
        <Link className="btn ghost" href="/app/tenders/results">Past results</Link></div>
      {error && <p className="error">{error.message}</p>}
      <div className="grid-main">
        <div className="stack-sm">
          {!(rivals || []).length && <div className="panel small muted">Not following anyone yet. Add a firm on the right, or pick one Dhandha found winning your kind of work.</div>}
          {(rivals || []).map((r) => (
            <div key={r.rival_id} className="panel stack-sm">
              <div className="row between">
                <div><strong>{r.name}</strong>{r.wins_90d > 0 && <span className="chip warn" style={{ marginLeft: 8 }}>{r.wins_90d} win{r.wins_90d === 1 ? "" : "s"} in 90 days</span>}</div>
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn sm ghost" href={`/app/tenders/results?bidder=${encodeURIComponent(r.name)}&days=1825`}>All their wins</Link>
                  {canEdit && <form action={stopRival}><input type="hidden" name="id" value={r.rival_id} /><SubmitButton className="sm ghost" confirm={`Stop following ${r.name}?`}>Stop following</SubmitButton></form>}
                </div>
              </div>
              {r.wins ? (
                <div className="small">
                  {r.wins} contract{r.wins === 1 ? "" : "s"} won · {lakh(r.total_value)} in all · latest {fmtDate(r.last_win)}: <span className="muted">{r.last_title}</span>
                  <div className="tiny faint" style={{ marginTop: 4 }}>
                    {r.states?.length ? `Wins in ${r.states.join(", ")}` : ""}{r.top_buyers?.length ? ` · mostly for ${r.top_buyers.join(", ")}` : ""}
                    {r.median_discount !== null && r.known_estimates > 0 ? ` · usually ${Number(r.median_discount) >= 0 ? `${Number(r.median_discount).toFixed(1)}% below` : `${(-Number(r.median_discount)).toFixed(1)}% above`} the estimate (${r.known_estimates} known)` : ""}
                  </div>
                </div>
              ) : <p className="small muted" style={{ margin: 0 }}>No award results for this name yet — Dhandha keeps watching. Check the spelling against the portal&apos;s award notices.</p>}
            </div>
          ))}
        </div>
        <div className="stack-sm">
          {canEdit && (
            <div className="panel">
              <h3>Follow a firm</h3>
              <form action={followRival} className="stack-sm"><input name="name" placeholder="Firm name as on award notices" maxLength={160} required /><SubmitButton>Follow</SubmitButton></form>
            </div>
          )}
          <div className="panel">
            <h3>Winning your kind of work</h3>
            {!(sugg || []).length && <p className="small muted" style={{ margin: 0 }}>No suggestions yet — they come from award results in your work types and states.</p>}
            {(sugg || []).map((s) => (
              <div key={s.name} className="row between small" style={{ padding: "5px 0", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap", gap: 8 }}>
                <span>{s.name}<div className="tiny faint">{s.wins} win{s.wins === 1 ? "" : "s"} · {lakh(s.total_value)}{s.states?.length ? ` · ${s.states.slice(0, 2).join(", ")}` : ""}</div></span>
                {canEdit && <form action={followRival}><input type="hidden" name="name" value={s.name} /><SubmitButton className="sm ghost">Follow</SubmitButton></form>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
