import Link from "next/link";
import { getContext, daysLeft, lakh, fmtDate } from "@/lib/session";
import { ScoreRing, Donut } from "@/components/Charts";
import Icon from "@/components/Icon";
import PreviewNote from "@/components/PreviewNote";
import { setTenderStatus } from "./actions";

const TABS = [["open", "Worth bidding"], ["shortlisted", "Shortlisted"], ["all", "All matches"], ["done", "Results"]];
const STATUS_CHIP = { new: ["info", "New"], shortlisted: ["warn", "Shortlisted"], preparing: ["warn", "Preparing bid"], submitted: ["info", "Submitted"], won: ["ok", "Won"], lost: ["bad", "Lost"], skipped: ["mute", "Skipped"] };

export default async function Tenders({ searchParams }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "open";
  const { supabase, company, role } = await getContext();
  const { data: all } = await supabase.from("tender_matches")
    .select("id, score, eligible, reasons, status, tenders(*)").eq("company_id", company.id).order("score", { ascending: false });
  const rows = (all || []).filter((m) => m.tenders);
  const live = (m) => daysLeft(m.tenders.due_at) >= 0;
  const list = rows.filter((m) =>
    tab === "open" ? live(m) && m.eligible && !["skipped", "won", "lost"].includes(m.status)
    : tab === "shortlisted" ? ["shortlisted", "preparing"].includes(m.status)
    : tab === "done" ? ["won", "lost", "submitted"].includes(m.status) : true);
  const byPack = ["construction", "it_services", "ca_audit", "goods_supply"].map((p, i) => ({
    label: { construction: "Construction", it_services: "IT / services", ca_audit: "CA / audit", goods_supply: "Goods supply" }[p],
    value: rows.filter((m) => m.tenders.industry_pack === p).length,
    color: ["var(--madder)", "var(--sky)", "var(--marigold)", "var(--leaf)"][i],
  }));
  const won = rows.filter((m) => m.status === "won").length, lost = rows.filter((m) => m.status === "lost").length;
  const canWrite = role !== "viewer";

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Tenders</h1>
          <p>Every tender from GeM, CPPP and state portals that fits {company.legal_name}, scored out of 100 with the reasons.</p>
        </div>
      </div>
      <PreviewNote>The live crawler and bid preparation arrive in Phase 1. Shortlist and skip already work.</PreviewNote>

      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Worth bidding now</div><div className="kpi">{rows.filter((m) => live(m) && m.eligible && !["skipped"].includes(m.status)).length}</div><div className="faint small">eligible and still open</div></div>
        <div className="panel ledger"><div className="kpi-label">Win rate</div><div className="kpi">{won + lost ? Math.round((won / (won + lost)) * 100) : 0}%</div><div className="faint small">{won} won · {lost} lost</div></div>
        <div className="panel row" style={{ flexWrap: "nowrap" }}>
          <Donut parts={byPack} size={96} center={String(rows.length)} />
          <div className="tiny" style={{ display: "grid", gap: 4 }}>
            {byPack.map((p) => <span key={p.label} className="row" style={{ gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: p.color }} />{p.label} · {p.value}</span>)}
          </div>
        </div>
      </div>

      <div className="row" role="tablist">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/app/tenders?tab=${k}`} role="tab" aria-selected={tab === k} className={`btn sm ${tab === k ? "" : "ghost"}`}>{label}</Link>
        ))}
      </div>

      <div className="panel flush">
        {!list.length && <p className="muted" style={{ padding: 22 }}>Nothing here yet.</p>}
        {list.map((m) => {
          const t = m.tenders, left = daysLeft(t.due_at), [cls, label] = STATUS_CHIP[m.status];
          return (
            <article key={m.id} className="tender">
              <ScoreRing score={m.score} size={56} />
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className={`chip ${cls}`}>{label}</span>
                  {!m.eligible && <span className="chip bad">Not eligible</span>}
                  <span className="tiny faint">{t.portal} · {t.tender_ref}</span>
                </div>
                <h4>{t.title}</h4>
                <div className="small muted">{t.authority}{t.district ? `, ${t.district}` : ""} · value {t.value_inr ? lakh(t.value_inr) : "not stated"} · EMD {t.emd_inr ? lakh(t.emd_inr) : "nil"}</div>
                <ul className="reasons">
                  {(m.reasons || []).map((r, i) => (
                    <li key={i}><Icon name={r.ok ? "check" : "cross"} size={14} style={{ color: r.ok ? "var(--leaf)" : "var(--blood)" }} />{r.text}</li>
                  ))}
                </ul>
                {canWrite && left >= 0 && (
                  <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    {m.status !== "shortlisted" && m.status !== "preparing" && (
                      <form action={setTenderStatus}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="shortlisted" /><button className="sm gold">Shortlist</button></form>
                    )}
                    {m.status !== "skipped" && (
                      <form action={setTenderStatus}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="skipped" /><button className="sm ghost">Skip</button></form>
                    )}
                    {m.status === "skipped" && (
                      <form action={setTenderStatus}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="new" /><button className="sm ghost">Restore</button></form>
                    )}
                    <button className="sm ghost" disabled title="Arrives in Phase 1">Prepare bid</button>
                  </div>
                )}
              </div>
              <div className="due">
                {left >= 0 ? (<><span className="tiny faint">Closes in</span><strong className={left <= 5 ? "error" : ""}>{left} day{left === 1 ? "" : "s"}</strong><span className="tiny faint">{fmtDate(t.due_at)}</span></>)
                  : (<><span className="tiny faint">Closed</span><strong>{fmtDate(t.due_at)}</strong></>)}
                {t.prebid_on && left >= 0 && <div className="tiny faint" style={{ marginTop: 6 }}>Pre-bid {fmtDate(t.prebid_on)}</div>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
