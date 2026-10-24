import Icon from "@/components/Icon";
import { mandatoryUnmet } from "@/lib/conditions";
import { lakh, fmtDate, daysLeft } from "@/lib/session";

// One-page brief of a tender: what it is, the numbers, the dates, the work, who can bid, what to submit,
// and the clauses to watch. Built from the portal page, the reading of the documents and the company's Vault.
export default function TenderBrief({ t, m, read, detail = {}, checklist = [], files = [] }) {
  const f = read?.fields || {};
  const msmeExempt = f.mse_emd_exempt ?? t.mse_emd_exempt;
  const left = daysLeft(t.due_at);
  const scope = (f.work_scope?.length ? f.work_scope : [detail.work_description || t.title]).filter(Boolean);
  const tiles = [
    ["Estimated value", (f.value_inr || t.value_inr || detail.value_inr) ? lakh(f.value_inr || t.value_inr || detail.value_inr) : "Not stated"],
    ["EMD", (f.emd_inr || t.emd_inr || detail.emd_inr) ? `${lakh(f.emd_inr || t.emd_inr || detail.emd_inr)}${msmeExempt ? " · MSE exempt" : ""}` : "Nil"],
    ["Tender fee", (f.tender_fee_inr || detail.fee_inr) ? lakh(f.tender_fee_inr || detail.fee_inr) : "Nil / not stated"],
    ["Completion period", f.completion_period || detail.period_of_work || "—"],
    ["Bid validity", f.bid_validity_days ? `${f.bid_validity_days} days` : detail.bid_validity || "—"],
    ["Performance security", f.performance_security_pct ? `${f.performance_security_pct}%` : "—"],
  ];
  // the portal's dates win; a date read from the documents only fills a gap, and never one before publishing
  const sane = (d) => d && !(t.published_on && new Date(d) < new Date(t.published_on)) ? d : null;
  const dates = [
    ["Published", t.published_on], ["Pre-bid meeting", t.prebid_on || detail.prebid_on || sane(f.prebid_on)],
    ["Bid closes", t.due_at || sane(f.due_at)], ["Bids opened", t.opening_at || detail.opening_at || sane(f.opening_at)],
  ].filter(([, d]) => d);
  const reasons = m.reasons || [];
  const Section = ({ icon, title, children }) => (
    <section style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
      <h4 className="row" style={{ gap: 8, margin: "0 0 8px", fontSize: 14 }}><Icon name={icon} size={16} style={{ color: "var(--madder)" }} />{title}</h4>
      {children}
    </section>
  );
  const list = (items) => <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }} className="small">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

  return (
    <article className="stack-sm" style={{ background: "var(--paper, #fff)", border: "1px solid var(--line)", borderRadius: 14, padding: 18, width: "100%" }}>
      <header>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <span className={`chip ${mandatoryUnmet(m.reasons).length || m.pending ? "warn" : "ok"}`}>{mandatoryUnmet(m.reasons).length ? (m.forced_at ? "Filing despite a warning" : "⚠ Mandatory condition not met") : m.pending ? `Qualifies if you answer ${m.pending}` : "Qualified"}</span>
          <span className={`chip ${left === null ? "mute" : left < 0 ? "mute" : left <= 5 ? "bad" : "info"}`}>{left === null ? "Closing date not known yet" : left < 0 ? "Closed" : `${left} day${left === 1 ? "" : "s"} left`}</span>
          <span className="tiny faint">{t.portal} · Tender ID {t.tender_ref}</span>
        </div>
        <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>{t.title}</h3>
        <div className="small muted" style={{ marginTop: 4 }}>{[t.authority, t.department].filter(Boolean).join(" · ")}{(f.location || detail.location || t.state) ? ` — ${f.location || detail.location || t.state}` : ""}</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {tiles.map(([l, v]) => (
          <div key={l} className="ledger tight" style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: "8px 10px 8px 20px" }}>
            <div className="kpi-label">{l}</div><div style={{ fontWeight: 700, fontSize: 15 }}>{v}</div>
          </div>
        ))}
      </div>

      {dates.length > 0 && (
        <div className="row" style={{ gap: 0, flexWrap: "wrap" }}>
          {dates.map(([l, d], i) => (
            <div key={l} style={{ flex: "1 1 120px", borderLeft: i ? "2px solid var(--line-soft)" : "none", padding: "2px 10px" }}>
              <div className="tiny faint">{l}</div><div className="small"><strong>{fmtDate(d)}</strong>{/T/.test(String(d)) ? `, ${new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}</div>
            </div>
          ))}
        </div>
      )}

      {read?.summary && <Section icon="sparkle" title="In short">{list(read.summary.split("\n"))}</Section>}
      <Section icon="briefcase" title="The work">{list(scope)}</Section>
      {!!f.highlights?.length && <Section icon="alert" title="Do not miss">{list(f.highlights)}</Section>}

      <Section icon="check" title="Can you bid?">
        <ul className="reasons" style={{ fontSize: 13.5, margin: 0 }}>
          {reasons.map((r, i) => <li key={i}><Icon name={r.ok ? "check" : r.ask ? "alert" : "cross"} size={14} style={{ color: r.ok ? "var(--leaf)" : r.ask ? "var(--marigold)" : "var(--blood)" }} />{r.text}</li>)}
        </ul>
      </Section>

      {checklist.length > 0 && (
        <Section icon="doc" title={`Documents to submit (${checklist.filter((x) => x.state === "ok").length} of ${checklist.length} in your Vault)`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 4 }} className="small">
            {checklist.map((x) => <span key={x.code} className="row" style={{ gap: 6 }}><span className={`chip ${x.state === "ok" ? "ok" : x.state === "expiring" ? "warn" : "bad"}`} style={{ minWidth: 64, justifyContent: "center" }}>{x.state === "ok" ? "Ready" : x.state === "expiring" ? "Renew" : "Missing"}</span>{x.name}</span>)}
          </div>
        </Section>
      )}
      {!!read?.formats?.length && <Section icon="tender" title={`Formats to fill (${read.formats.length})`}>{list(read.formats.map((x) => `${x.title}${x.page ? ` (p. ${x.page})` : ""}`))}</Section>}
      {!!read?.risks?.length && (
        <Section icon="alert" title="Clauses to watch">
          {list(read.risks.map((r) => <span key={r.label}><strong>{r.label}</strong>{r.page ? ` (p. ${r.page})` : ""}: {r.text}</span>))}
        </Section>
      )}
      {files.length > 0 && <div className="tiny faint">Read from {files.length} document{files.length === 1 ? "" : "s"}: {files.map((x) => x.file_name).join(", ").slice(0, 300)}</div>}
    </article>
  );
}
