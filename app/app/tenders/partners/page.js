import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import FormState from "../../FormState";
import SubmitButton from "@/components/SubmitButton";
import { STATES } from "@/lib/conditions";
import { PACKS } from "@/lib/leads";
import { KINDS, STATUS, requestText, sortInbox } from "@/lib/partners";
import { saveProfile, sendRequest, answerRequest, postSubwork, closeSubwork } from "./actions";

export const metadata = { title: "Partners" };

const TABS = [["find", "Find partners"], ["requests", "Requests"], ["subwork", "Sub-work"], ["profile", "Our partner profile"]];

export default async function Partners({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp?.tab) ? sp.tab : "find";
  const { supabase, company, role } = await getContext();
  const lead = ["admin", "manager"].includes(role), canAsk = ["admin", "manager", "bid_preparer"].includes(role);
  // a tender we are short on: its work type and state preselect the search
  const { data: m } = sp?.match ? await supabase.from("tender_matches").select("id, tenders(id, title, state, industry_pack)").eq("id", sp.match).eq("company_id", company.id).maybeSingle() : { data: null };
  const t = m?.tenders;
  const pack = sp?.pack ?? t?.industry_pack ?? "", state = sp?.state ?? t?.state ?? "", kind = sp?.kind === "subcontract" ? "subcontract" : "consortium";
  const [{ data: prof }, { data: cands }, { data: inbox }, { data: feed }, { data: mine }, { data: me }] = await Promise.all([
    supabase.from("partner_profiles").select("*").eq("company_id", company.id).maybeSingle(),
    tab === "find" ? supabase.rpc("partner_candidates", { p_company: company.id, p_pack: pack || null, p_state: state || null, p_kind: kind }) : Promise.resolve({ data: [] }),
    supabase.rpc("partner_inbox", { p_company: company.id }),
    tab === "subwork" ? supabase.rpc("subwork_feed", { p_company: company.id }) : Promise.resolve({ data: [] }),
    tab === "subwork" ? supabase.from("subwork_posts").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    supabase.from("companies").select("legal_name, trade_name").eq("id", company.id).single(),
  ]);
  const box = sortInbox(inbox || []);
  const myName = me?.trade_name || me?.legal_name;
  const q = (o) => `/app/tenders/partners?${new URLSearchParams({ tab, ...(sp?.match ? { match: sp.match } : {}), ...o })}`;

  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Partners</h1><p>Short of turnover or similar work for a tender? Bid as a consortium / JV with another Dhandha firm, or give out and take up sub-work. Firms share only name, city, turnover band and experience count — contact details only after they accept. Free.</p></div></div>
      <nav className="row" style={{ gap: 6 }}>{TABS.map(([k, l]) => <Link key={k} href={`/app/tenders/partners?tab=${k}${sp?.match ? `&match=${sp.match}` : ""}`} className={`btn sm ${tab === k ? "" : "ghost"}`}>{l}{k === "requests" && box.toAnswer.length ? ` (${box.toAnswer.length})` : ""}</Link>)}</nav>
      {!prof?.open && tab !== "profile" && <div className="notice small">Your firm is not listed as a partner yet — others cannot find you. <Link href="/app/tenders/partners?tab=profile">Open your partner profile</Link>.</div>}

      {tab === "find" && (
        <>
          <form className="panel row" style={{ gap: 10, alignItems: "flex-end" }}>
            <input type="hidden" name="tab" value="find" />{sp?.match && <input type="hidden" name="match" value={sp.match} />}
            <div style={{ flex: "1 1 180px" }}><label htmlFor="p-kind">Looking for</label><select id="p-kind" name="kind" defaultValue={kind}><option value="consortium">Consortium / JV partner</option><option value="subcontract">A sub-contractor</option></select></div>
            <div style={{ flex: "1 1 180px" }}><label htmlFor="p-pack">Kind of work</label><select id="p-pack" name="pack" defaultValue={pack}><option value="">Any</option>{Object.entries(PACKS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div style={{ flex: "1 1 160px" }}><label htmlFor="p-state">State</label><select id="p-state" name="state" defaultValue={state}><option value="">Any</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <button className="btn">Search</button>
          </form>
          {t && <p className="small" style={{ margin: 0 }}>For tender: <strong>{t.title}</strong></p>}
          <div className="stack-sm">
            {!(cands || []).length && <div className="panel small muted">No open partner firms match yet. Partners join as more businesses use Dhandha — try “Any” state, or post your need under Sub-work.</div>}
            {(cands || []).map((c) => (
              <div key={c.company_id} className="panel stack-sm">
                <div className="row between"><div><strong>{c.name}</strong> <span className="small muted">{[c.city, c.state].filter(Boolean).join(", ")}</span></div>
                  <span className="small faint">{[c.turnover_band && `Turnover ${c.turnover_band}`, c.years != null && `${c.years} yrs`, `${c.works} completed works`].filter(Boolean).join(" · ")}</span></div>
                {c.blurb && <p className="small" style={{ margin: 0 }}>{c.blurb}</p>}
                {canAsk && (
                  <FormState action={sendRequest} submit="Send request" className="stack-sm">
                    <input type="hidden" name="to" value={c.company_id} /><input type="hidden" name="kind" value={kind} />{t && <input type="hidden" name="tender" value={t.id} />}
                    <textarea name="message" rows={2} maxLength={1000} defaultValue={requestText({ tenderTitle: t?.title, kind, from: myName })} />
                  </FormState>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "requests" && (
        <div className="stack-sm">
          {!(inbox || []).length && <div className="panel small muted">No partner requests yet.</div>}
          {[["Waiting for your answer", box.toAnswer], ["You asked — waiting for them", box.sent], ["Answered", box.settled]].map(([title, rows]) => rows.length > 0 && (
            <div key={title} className="panel flush table-wrap">
              <h3 style={{ padding: "14px 16px 0" }}>{title}</h3>
              <table><tbody>{rows.map((r) => { const [cls, txt] = STATUS[r.status]; return (
                <tr key={r.id}>
                  <td className="small"><strong>{r.other_name}</strong>{r.other_city ? <span className="faint"> · {r.other_city}</span> : null}<div className="tiny faint">{KINDS[r.kind]}{r.tender_title ? ` · ${r.tender_title}` : ""}{r.subwork_title ? ` · ${r.subwork_title}` : ""} · {fmtDate(r.created_at)}</div>{r.message && <div className="tiny" style={{ marginTop: 4 }}>{r.message}</div>}</td>
                  <td className="small">{r.status === "accepted" ? <>{r.contact_person && <div>{r.contact_person}</div>}{r.phone && <a href={`tel:${r.phone}`}>{r.phone}</a>}{r.email && <div><a href={`mailto:${r.email}`}>{r.email}</a></div>}{!r.phone && !r.email && <span className="faint">No contact details in their Vault yet</span>}</> : <span className={`chip ${cls}`}>{txt}</span>}</td>
                  <td>{r.direction === "in" && r.status === "pending" && lead && (
                    <div className="row" style={{ gap: 4 }}>
                      <form action={answerRequest}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="accept" value="1" /><SubmitButton className="sm">Accept &amp; share contacts</SubmitButton></form>
                      <form action={answerRequest}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="accept" value="0" /><SubmitButton className="sm ghost">Decline</SubmitButton></form>
                    </div>)}</td>
                </tr>); })}</tbody></table>
            </div>
          ))}
        </div>
      )}

      {tab === "subwork" && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="stack-sm">
            <h3 style={{ margin: 0 }}>Sub-work from other firms</h3>
            {!(feed || []).length && <div className="panel small muted">Nothing open in your kind of work and states right now.</div>}
            {(feed || []).map((s) => (
              <div key={s.id} className="panel stack-sm">
                <div><strong>{s.title}</strong><div className="tiny faint">{s.poster} · {[s.city, s.state].filter(Boolean).join(", ")}{s.value_inr ? ` · about ${lakh(s.value_inr)}` : ""}{s.closes_on ? ` · till ${fmtDate(s.closes_on)}` : ""}</div></div>
                {s.details && <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{s.details}</p>}
                {s.interested ? <span className="chip ok">You showed interest</span> : canAsk && (
                  <FormState action={sendRequest} submit="I'm interested" className="stack-sm">
                    <input type="hidden" name="kind" value="subwork_interest" /><input type="hidden" name="subwork" value={s.id} />
                    <textarea name="message" rows={2} maxLength={1000} defaultValue={`Namaste — ${myName || "we"} can take up this work. Can we talk?`} />
                  </FormState>
                )}
              </div>
            ))}
          </div>
          <div className="stack-sm">
            {canAsk && (
              <div className="panel">
                <h3>Give out sub-work</h3>
                <FormState action={postSubwork} submit="Post">
                  <div><label htmlFor="sw-t">What work</label><input id="sw-t" name="title" maxLength={160} placeholder="e.g. Branch audits of 12 bank branches, Bihar" required /></div>
                  <div><label htmlFor="sw-d">Details</label><textarea id="sw-d" name="details" rows={3} maxLength={2000} /></div>
                  <div className="form-grid">
                    <div><label htmlFor="sw-p">Kind of work</label><select id="sw-p" name="industry_pack"><option value="">Any</option>{Object.entries(PACKS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                    <div><label htmlFor="sw-s">State</label><select id="sw-s" name="state"><option value="">Any</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
                    <div><label htmlFor="sw-c">City</label><input id="sw-c" name="city" maxLength={80} /></div>
                    <div><label htmlFor="sw-v">Value (₹, optional)</label><input id="sw-v" name="value_inr" inputMode="numeric" /></div>
                    <div><label htmlFor="sw-u">Open till</label><input id="sw-u" name="closes_on" type="date" /></div>
                  </div>
                </FormState>
              </div>
            )}
            <div className="panel">
              <h3>Your posts</h3>
              {!(mine || []).length && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
              {(mine || []).map((s) => (
                <div key={s.id} className="row between small" style={{ padding: "5px 0", borderTop: "1px solid var(--line-soft)" }}>
                  <span>{s.title}<div className="tiny faint">{s.status === "open" ? "Open" : "Closed"} · {fmtDate(s.created_at)}</div></span>
                  {s.status === "open" && canAsk && <form action={closeSubwork}><input type="hidden" name="id" value={s.id} /><SubmitButton className="sm ghost">Close</SubmitButton></form>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="panel" style={{ maxWidth: 640 }}>
          <h3>Our partner profile</h3>
          {lead ? (
            <FormState action={saveProfile}>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="open" defaultChecked={prof?.open} style={{ width: "auto" }} /><strong>List us as a partner</strong> — other Dhandha firms can find us and send requests</label>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="consortium" defaultChecked={prof ? prof.consortium : true} style={{ width: "auto" }} />Open to consortium / JV bids</label>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="sub_take" defaultChecked={prof ? prof.sub_take : true} style={{ width: "auto" }} />We take up sub-contract work</label>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="sub_give" defaultChecked={prof ? prof.sub_give : true} style={{ width: "auto" }} />We give out sub-contract work</label>
              <div><label htmlFor="pp-st">States we work in (comma-separated; empty = all India)</label><input id="pp-st" name="states" defaultValue={(prof?.states || []).join(", ")} placeholder="Haryana, Delhi, Uttar Pradesh" /></div>
              <div><label htmlFor="pp-b">One line about us</label><textarea id="pp-b" name="blurb" rows={2} maxLength={500} defaultValue={prof?.blurb || ""} placeholder="e.g. Class-A civil contractor, 15 years of road and drain works for PWD and HSVP" /></div>
              <p className="tiny faint" style={{ margin: 0 }}>Shown to others: firm name, city, state, turnover band (e.g. ₹5–25 Cr, never the figure), years in business, number of completed works and this line. Phone and email only after you accept a request.</p>
            </FormState>
          ) : <p className="small muted">{prof?.open ? "Listed as a partner." : "Not listed."} Admins and managers change this.</p>}
        </div>
      )}
    </div>
  );
}
