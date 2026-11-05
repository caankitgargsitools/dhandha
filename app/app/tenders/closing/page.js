import Link from "next/link";
import { getContext, lakh } from "@/lib/session";
import { ScoreRing } from "@/components/Charts";
import { readiness, timeLeft } from "@/lib/readiness";
import Countdown from "./Countdown";

export const metadata = { title: "Closing soon" };

// Deadline cockpit (brief §3.1): every bid in hand, soonest closing first, with a live countdown and how ready it is.
export default async function Closing() {
  const { supabase, company } = await getContext();
  const { data: ms } = await supabase.from("tender_matches")
    .select("id, status, quoted_price, filled_formats, tender_id, tenders!inner(id, title, authority, portal, due_at, value_inr)")
    .eq("company_id", company.id).in("status", ["shortlisted", "preparing", "submitted"])
    .gte("tenders.due_at", new Date(Date.now() - 86400000).toISOString()).limit(120);
  const list = ms || [];
  const ids = list.map((m) => m.id), tids = list.map((m) => m.tender_id);
  const [{ data: reads }, { data: signs }, { data: packs }] = ids.length ? await Promise.all([
    supabase.from("tender_reads").select("tender_id, engine").in("tender_id", tids),
    supabase.from("bid_signoffs").select("match_id, step, decision, created_at").in("match_id", ids),
    supabase.from("bid_packs").select("match_id, kind").in("match_id", ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const rows = list.map((m) => ({
    m, t: m.tenders, left: timeLeft(m.tenders.due_at),
    r: readiness({ match: m, readEngines: (reads || []).filter((x) => x.tender_id === m.tender_id).map((x) => x.engine), signoffs: (signs || []).filter((x) => x.match_id === m.id), packs: (packs || []).filter((x) => x.match_id === m.id) }),
  })).sort((a, b) => new Date(a.t.due_at || 8.64e15) - new Date(b.t.due_at || 8.64e15));
  const urgent = rows.filter((x) => x.m.status !== "submitted" && x.left.hours !== null && x.left.hours < 48 && x.left.hours > 0);

  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Closing soon</h1><p>Every bid you have shortlisted, are preparing or have filed — soonest closing first, with how ready each one is. Your phone is alerted 72, 24 and 6 hours before closing for bids not yet filed.</p></div></div>
      {urgent.length > 0 && <div className="notice bad small"><strong>{urgent.length} bid{urgent.length === 1 ? " closes" : "s close"} within 48 hours and {urgent.length === 1 ? "is" : "are"} not filed yet.</strong></div>}
      {!rows.length && (
        <div className="panel empty-state">
          <p className="muted" style={{ margin: 0 }}>Nothing in hand. Shortlist a tender from the Tenders page and it appears here with its countdown.</p>
          <Link href="/app/tenders" className="btn sm" style={{ marginTop: 10 }}>Find tenders</Link>
        </div>
      )}
      <div className="stack-sm">
        {rows.map(({ m, t, left, r }) => (
          <div key={m.id} className="panel closing-row">
            <ScoreRing score={r.pct} size={52} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={`/app/tenders/${m.id}`} style={{ fontWeight: 600, color: "inherit" }}>{t.title}</Link>
              <div className="tiny faint">{[t.authority, t.portal, t.value_inr ? lakh(t.value_inr) : null].filter(Boolean).join(" · ")}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                {r.steps.map((s) => <span key={s.key} className={`chip ${s.done ? "ok" : "mute"}`}>{s.done ? "✓" : "○"} {s.label}</span>)}
              </div>
            </div>
            <div className="closing-side">
              <Countdown dueAt={t.due_at} initial={left} />
              <span className={`chip ${m.status === "submitted" ? "ok" : "info"}`}>{m.status === "submitted" ? "Filed" : m.status === "preparing" ? "Preparing" : "Shortlisted"}</span>
              {m.status !== "submitted" && <Link className="btn sm" href={`/app/tenders/${m.id}/assistant`}>{r.next ? `Next: ${r.next}` : "Open"}</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
