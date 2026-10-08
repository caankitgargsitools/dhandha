import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, fmtDate, lakh, calDays } from "@/lib/session";
import { ScoreRing } from "@/components/Charts";
import Icon from "@/components/Icon";
import FormState from "../../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { Timeline, LogActivity } from "@/components/CrmTimeline";
import { SOURCES, LEAD_STATUS, STAGES, telLink, waLink, fillTemplate, DEFAULT_TEMPLATE } from "@/lib/leads";
import { updateLead, createDealFromLead } from "../actions";

const toDate = (d) => (d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10) : "");

export default async function LeadDetail({ params }) {
  const { id } = await params;
  const { supabase, tenant, company, user, role } = await getContext();
  const { data: l } = await supabase.from("leads").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!l) notFound();
  const [{ data: acts }, { data: deals }, { data: members }, { data: ideal }] = await Promise.all([
    supabase.from("crm_activities").select("*").eq("lead_id", l.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("deals").select("id, title, stage, value_inr").eq("lead_id", l.id).order("created_at", { ascending: false }),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
    supabase.from("lead_preferences").select("wa_template").eq("company_id", company.id).maybeSingle(),
  ]);
  const name = (uid) => { const m = (members || []).find((x) => x.user_id === uid); return m ? (uid === user.id ? "You" : m.profiles?.full_name || m.profiles?.email) : "Former member"; };
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const canWrite = role !== "viewer";
  const isLead = ["admin", "manager", "bid_preparer"].includes(role);
  const wa = waLink(l.phone, fillTemplate(ideal?.wa_template || DEFAULT_TEMPLATE, l, company));
  const tel = telLink(l.phone);
  const d = l.next_follow_up_at ? calDays(l.next_follow_up_at) : null;
  const stage = Object.fromEntries(STAGES);

  return (
    <div className="stack">
      <Link href="/app/leads" className="small">All leads</Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 16 }}>
          <ScoreRing score={l.score || 0} size={64} />
          <div>
            <h1 style={{ fontSize: 26 }}>{l.name}</h1>
            <p>{[l.contact_person, l.industry, [l.city, l.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
            <div className="row tiny" style={{ gap: 8, marginTop: 6 }}>
              <span className={`chip ${LEAD_STATUS[l.status][0]}`}>{LEAD_STATUS[l.status][1]}</span>
              <span className="chip mute plain">{SOURCES[l.source]}</span>
              <span className="faint">Owner: {l.owner_id ? name(l.owner_id) : "Unassigned"} · added {fmtDate(l.created_at)}</span>
              {d !== null && <span className={`chip ${d < 0 ? "bad" : d === 0 ? "warn" : "mute"}`}>Follow up {d < 0 ? `${-d} d late` : d === 0 ? "today" : fmtDate(l.next_follow_up_at)}</span>}
            </div>
          </div>
        </div>
        <div className="row">
          {l.dnd ? <span className="chip bad">Do not disturb: no calls or messages</span> : <>
            {tel && <a className="btn" href={tel}><Icon name="phone" size={15} /> Call</a>}
            {wa && <a className="btn gold" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            {l.email && <a className="btn ghost" href={`mailto:${l.email}`}><Icon name="mail" size={15} /> Email</a>}
          </>}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm">
          {canWrite && (
            <div className="panel">
              <h3>Log a call or message</h3>
              <p className="small muted" style={{ marginTop: 0 }}>Call or WhatsApp with the buttons above, then note how it went here.</p>
              <LogActivity leadId={l.id} />
            </div>
          )}
          <div className="panel">
            <h3>Timeline</h3>
            <Timeline items={acts} name={name} />
          </div>
        </div>

        <div className="stack-sm">
          <div className="panel">
            <div className="panel-head"><h3>Deals</h3>{l.last_contacted_at && <span className="tiny faint">last contact {fmtDate(l.last_contacted_at)}</span>}</div>
            {(deals || []).map((x) => (
              <Link key={x.id} href={`/app/crm/${x.id}`} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span>{x.title}</span><span className="row" style={{ gap: 8 }}><strong className="num">{x.value_inr ? lakh(x.value_inr) : "—"}</strong><span className="chip mute plain">{stage[x.stage]}</span></span>
              </Link>
            ))}
            {canWrite && (
              <details open={!(deals || []).length && ["interested", "contacted"].includes(l.status)} style={{ marginTop: 8 }}>
                <summary className="small"><strong>Open a deal</strong></summary>
                <FormState action={createDealFromLead} submit="Open deal">
                  <input type="hidden" name="lead_id" value={l.id} />
                  <div><label htmlFor="title">What are you selling</label><input id="title" name="title" maxLength={200} defaultValue={`Work for ${l.name}`.slice(0, 200)} /></div>
                  <div className="form-grid">
                    <div><label htmlFor="value_inr">Value (₹)</label><input id="value_inr" name="value_inr" inputMode="numeric" placeholder="250000" /></div>
                    <div><label htmlFor="dnext">Next step</label><input id="dnext" name="next_action" maxLength={120} defaultValue="Send proposal" /></div>
                    <div><label htmlFor="next_at">By</label><input id="next_at" name="next_at" type="date" /></div>
                  </div>
                </FormState>
              </details>
            )}
          </div>

          {l.score_reasons?.length > 0 && (
            <div className="panel">
              <h3>Why this score</h3>
              <ul className="reasons">{l.score_reasons.map((r) => <li key={r}><Icon name="check" size={14} />{r}</li>)}</ul>
            </div>
          )}

          <div className="panel">
            <h3>Details</h3>
            {canWrite ? (
              <FormState action={updateLead}>
                <input type="hidden" name="id" value={l.id} />
                <div className="form-grid">
                  <div><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={l.status}>{Object.entries(LEAD_STATUS).map(([k, [, lbl]]) => <option key={k} value={k}>{lbl}</option>)}</select></div>
                  {isLead ? <OwnerSelect members={sellers} me={user.id} value={l.owner_id} /> : <input type="hidden" name="owner_id" value={l.owner_id || ""} />}
                  <div><label htmlFor="lfollow">Next follow-up</label><input id="lfollow" name="follow_up" type="date" defaultValue={toDate(l.next_follow_up_at)} /></div>
                </div>
                <div className="form-grid">
                  <div><label htmlFor="contact_person">Contact person</label><input id="contact_person" name="contact_person" defaultValue={l.contact_person || ""} maxLength={120} /></div>
                  <div><label htmlFor="phone">Mobile</label><input id="phone" name="phone" defaultValue={l.phone || ""} maxLength={40} /></div>
                  <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={l.email || ""} /></div>
                  <div><label htmlFor="industry">Industry</label><input id="industry" name="industry" defaultValue={l.industry || ""} maxLength={120} /></div>
                  <div><label htmlFor="city">City</label><input id="city" name="city" defaultValue={l.city || ""} maxLength={80} /></div>
                  <div><label htmlFor="state">State</label><input id="state" name="state" defaultValue={l.state || ""} maxLength={80} /></div>
                  <div><label htmlFor="website">Website</label><input id="website" name="website" defaultValue={l.website || ""} /></div>
                </div>
                <div><label htmlFor="lnotes">Notes</label><textarea id="lnotes" name="notes" rows={3} defaultValue={l.notes || ""} /></div>
                <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="dnd" defaultChecked={l.dnd} style={{ width: "auto" }} /> Do not disturb (registered on NCPR or asked not to be contacted)</label>
              </FormState>
            ) : (
              <dl className="small">{[["Phone", l.phone], ["Email", l.email], ["Website", l.website], ["Notes", l.notes]].map(([k, v]) => <div key={k}><dt className="faint tiny">{k}</dt><dd style={{ margin: "0 0 8px" }}>{v || "—"}</dd></div>)}</dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
