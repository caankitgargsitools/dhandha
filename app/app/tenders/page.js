import Link from "next/link";
import { getContext, daysLeft, lakh, fmtDate } from "@/lib/session";
import { ScoreRing, Donut } from "@/components/Charts";
import Icon from "@/components/Icon";
import PreviewNote from "@/components/PreviewNote";
import { setTenderStatus } from "./actions";
import { rescore, muteTenderWord } from "./bidActions";
import QuestionCards from "./QuestionCards";
import { openQuestions, mandatoryUnmet } from "@/lib/conditions";
import { parseFilters, applyFilters, activeCount, facets, STAGES, LEFT, WORK, SORTS, ELIG } from "@/lib/tenderFilters";

const TABS = [["open", "Worth bidding"], ["shortlisted", "Shortlisted"], ["all", "All matches"], ["done", "Results"]];
const STATUS_CHIP = { new: ["info", "New"], shortlisted: ["warn", "Shortlisted"], preparing: ["warn", "Preparing bid"], submitted: ["info", "Submitted"], won: ["ok", "Won"], lost: ["bad", "Lost"], skipped: ["mute", "Skipped"] };

export default async function Tenders({ searchParams }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "open";
  const { supabase, company, role } = await getContext();
  const { data: all } = await supabase.from("tender_matches")
    .select("id, score, eligible, pending, reasons, status, matched_on, unfit, forced_at, tenders(*)").eq("company_id", company.id).order("score", { ascending: false });
  // matches that no longer fit the search are hidden unless someone already acted on them
  const rows = (all || []).filter((m) => m.tenders && !(m.unfit && ["new", "skipped"].includes(m.status)));
  const { data: pref } = await supabase.from("tender_preferences").select("services, custom_keywords").eq("company_id", company.id).maybeSingle();
  const noPrefs = !pref || (!(pref.services || []).length && !(pref.custom_keywords || []).length);
  const live = (m) => daysLeft(m.tenders.due_at) >= 0;
  const f = parseFilters(params);
  const nf = activeCount(f);
  // a stage or "closed" filter looks across every tab
  const wide = f.stage.length || f.left === "closed";
  const tabbed = rows.filter((m) =>
    // a tender that misses a mandatory condition stays in the list with a warning; the person decides
    wide ? true
    : tab === "open" ? live(m) && !["skipped", "won", "lost"].includes(m.status)
    : tab === "shortlisted" ? ["shortlisted", "preparing"].includes(m.status)
    : tab === "done" ? ["won", "lost", "submitted"].includes(m.status) : true);
  const list = applyFilters(tabbed.map((m) => ({ ...m, unmet: mandatoryUnmet(m.reasons).length > 0 })), f);
  const fc = facets(rows);
  const byPack = ["construction", "it_services", "ca_audit", "goods_supply"].map((p, i) => ({
    label: { construction: "Construction", it_services: "IT / services", ca_audit: "CA / audit", goods_supply: "Goods supply" }[p],
    value: rows.filter((m) => m.tenders.industry_pack === p).length,
    color: ["var(--madder)", "var(--sky)", "var(--marigold)", "var(--leaf)"][i],
  }));
  const won = rows.filter((m) => m.status === "won").length, lost = rows.filter((m) => m.status === "lost").length;
  const canWrite = role !== "viewer";
  const { data: facts } = await supabase.from("company_facts").select("key, value").eq("company_id", company.id).eq("period", "");
  const answers = Object.fromEntries((facts || []).map((f) => [f.key, f.value]));
  const questions = openQuestions(rows.filter((m) => live(m) && !["skipped", "lost"].includes(m.status)), answers);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Tenders</h1>
          <p>Every tender from GeM, CPPP and state portals that fits {company.legal_name}, scored out of 100 against your Vault.</p>
        </div>
        <div className="row">
          <Link href="/app/tenders/preferences" className="btn ghost">What to look for</Link>
          <form action={rescore}><button className="gold">Re-score now</button></form>
        </div>
      </div>
      {noPrefs && <div className="notice bad"><Icon name="briefcase" /><span><strong>Tell Dhandha what you do</strong> — pick your industry, sub-industry and services so only relevant tenders reach you. <Link href="/app/tenders/preferences">Choose services</Link></span></div>}
      {questions.length > 0 && <QuestionCards questions={questions} canAnswer={canWrite} />}
      <PreviewNote>Tenders shown are samples until the crawler server is switched on. Scoring, shortlisting and bid packs are live.</PreviewNote>

      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Worth bidding now</div><div className="kpi">{rows.filter((m) => live(m) && m.eligible && !["skipped"].includes(m.status)).length}</div><div className="faint small">eligible and still open{rows.some((m) => live(m) && m.eligible && m.pending) ? ` · ${rows.filter((m) => live(m) && m.eligible && m.pending).length} need your answers` : ""}</div></div>
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
          <Link key={k} href={`/app/tenders?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params || {}).filter(([x]) => x !== "tab").map(([x, v]) => [x, String(v)])), tab: k })}`} role="tab" aria-selected={tab === k} className={`btn sm ${tab === k ? "" : "ghost"}`}>{label}</Link>
        ))}
      </div>

      <details className="panel" open={nf > 0}>
        <summary className="row between" style={{ cursor: "pointer" }}>
          <strong>Filter and sort {nf ? <span className="chip info">{nf} on</span> : null}</strong>
          <span className="tiny faint">{list.length} tender{list.length === 1 ? "" : "s"} shown</span>
        </summary>
        <form className="stack-sm" style={{ marginTop: 12 }}>
          <input type="hidden" name="tab" value={tab} />
          <div className="form-grid">
            <div><label htmlFor="f-q">Search</label><input id="f-q" name="q" defaultValue={f.q} placeholder="Title, authority or tender no." /></div>
            <div><label htmlFor="f-stage">Stage</label><select id="f-stage" name="stage" defaultValue={f.stage[0] || ""}><option value="">Any</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label htmlFor="f-left">Time left</label><select id="f-left" name="left" defaultValue={f.left}><option value="">Any</option>{LEFT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label htmlFor="f-work">Type of work</label><select id="f-work" name="work" defaultValue={f.work}><option value="">Any</option>{WORK.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label htmlFor="f-vmin">Value from (₹ lakh)</label><input id="f-vmin" name="vmin" type="number" min={0} step="any" defaultValue={f.vmin ?? ""} /></div>
            <div><label htmlFor="f-vmax">Value up to (₹ lakh)</label><input id="f-vmax" name="vmax" type="number" min={0} step="any" defaultValue={f.vmax ?? ""} /></div>
            <div><label htmlFor="f-elig">Eligibility</label><select id="f-elig" name="elig" defaultValue={f.elig}><option value="">Any</option>{ELIG.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label htmlFor="f-cat">Category</label><select id="f-cat" name="cat" defaultValue={f.cat}><option value="">Any</option>{fc.cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label htmlFor="f-portal">Portal</label><select id="f-portal" name="portal" defaultValue={f.portal}><option value="">Any</option>{fc.portals.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label htmlFor="f-state">State</label><select id="f-state" name="state" defaultValue={f.state}><option value="">Any</option>{fc.states.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" defaultValue={f.sort}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div className="row" style={{ gap: 8 }}><button className="sm">Apply</button>{nf > 0 && <Link className="btn sm ghost" href={`/app/tenders?tab=${tab}`}>Clear filters</Link>}</div>
        </form>
      </details>

      <div className="panel flush">
        {!list.length && <p className="muted" style={{ padding: 22 }}>{nf ? "No tenders match these filters." : "Nothing here yet."}</p>}
        {list.map((m) => {
          const t = m.tenders, left = daysLeft(t.due_at), [cls, label] = STATUS_CHIP[m.status];
          return (
            <article key={m.id} className="tender">
              <ScoreRing score={m.score} size={56} />
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className={`chip ${cls}`}>{label}</span>
                  {m.unfit && <span className="chip mute" title="Kept because someone already acted on it. Skip it to hide it.">No longer matches what you do</span>}
                  {mandatoryUnmet(m.reasons).length ? <span className="chip warn" title={mandatoryUnmet(m.reasons).join("; ")}>{m.forced_at ? "Filing despite a warning" : "⚠ Mandatory condition not met"}</span> : !m.eligible ? <span className="chip mute">Outside your preferences</span> : m.pending ? <Link href={`/app/tenders/${m.id}/assistant`} className="chip warn">Qualifies if you answer {m.pending}</Link> : <span className="chip ok">Qualified</span>}
                  <span className="tiny faint">{t.portal} · {t.tender_ref}</span>
                </div>
                <h4><Link href={`/app/tenders/${m.id}`} style={{ color: "inherit" }}>{t.title}</Link></h4>
                <div className="small muted">{t.authority}{t.district ? `, ${t.district}` : ""} · value {t.value_inr ? lakh(t.value_inr) : "not stated"} · EMD {t.emd_inr ? lakh(t.emd_inr) : "nil"}</div>
                {m.matched_on?.length > 0 && (
                  <div className="row tiny" style={{ gap: 6, marginTop: 6 }}>
                    <span className="faint">Matched on:</span>
                    {m.matched_on.map((w) => (
                      <span key={w} className="chip mute" style={{ gap: 4 }}>{w}
                        {canWrite && <form action={muteTenderWord} style={{ display: "inline" }}><input type="hidden" name="word" value={w} /><button className="link" title={`Never match "${w}" again`} aria-label={`Never match ${w} again`} style={{ padding: 0, border: 0, background: "none", color: "inherit", cursor: "pointer", fontSize: 13 }}>×</button></form>}
                      </span>
                    ))}
                  </div>
                )}
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
                    <Link className="btn sm ghost" href={`/app/tasks?link_type=tender&link_id=${t.id}&link_label=${encodeURIComponent(t.title.slice(0, 80))}&title=${encodeURIComponent("Prepare bid: " + t.title.slice(0, 120))}`}>Assign to someone</Link>
                    <Link className="btn sm" href={`/app/tenders/${m.id}/assistant`}>Prepare with assistant</Link>
                    <Link className="btn sm ghost" href={`/app/tenders/${m.id}`}>Details</Link>
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
