import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, lakh, fmtDate, calDays } from "@/lib/session";
import Icon from "@/components/Icon";
import FormState from "../../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { Timeline, LogActivity } from "@/components/CrmTimeline";
import { STAGES, telLink, waLink } from "@/lib/leads";
import { updateDeal } from "../actions";

const toDate = (d) => (d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10) : "");

export default async function DealDetail({ params }) {
  const { id } = await params;
  const { supabase, tenant, company, user, role } = await getContext();
  const { data: d } = await supabase.from("deals").select("*, leads(id, name, contact_person, phone, email, city, dnd)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!d) notFound();
  const [{ data: acts }, { data: members }] = await Promise.all([
    // the deal's own entries plus everything logged on its lead
    d.lead_id
      ? supabase.from("crm_activities").select("*").or(`deal_id.eq.${d.id},lead_id.eq.${d.lead_id}`).order("created_at", { ascending: false }).limit(100)
      : supabase.from("crm_activities").select("*").eq("deal_id", d.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
  ]);
  const name = (uid) => { const m = (members || []).find((x) => x.user_id === uid); return m ? (uid === user.id ? "You" : m.profiles?.full_name || m.profiles?.email) : "Former member"; };
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const stage = Object.fromEntries(STAGES);
  const lead = d.leads;
  const left = d.next_action_at ? calDays(d.next_action_at) : null;
  const isOpen = !["won", "lost"].includes(d.stage);
  const canWrite = role !== "viewer";
  const idx = STAGES.findIndex(([k]) => k === d.stage);

  return (
    <div className="stack">
      <Link href="/app/crm" className="small">Pipeline</Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{d.title}</h1>
          <p>{lead ? <Link href={`/app/leads/${lead.id}`}>{lead.name}</Link> : "No lead linked"}{lead?.contact_person ? ` · ${lead.contact_person}` : ""}{lead?.city ? ` · ${lead.city}` : ""}</p>
          <div className="row tiny" style={{ gap: 8, marginTop: 6 }}>
            <span className={`chip ${d.stage === "won" ? "ok" : d.stage === "lost" ? "bad" : "info"}`}>{stage[d.stage]}</span>
            <span className="faint">Owner: {d.owner_id ? name(d.owner_id) : d.owner_name || "Unassigned"} · opened {fmtDate(d.created_at)}{d.closed_at ? ` · closed ${fmtDate(d.closed_at)}` : ""}</span>
            {d.escalated_at && isOpen && <span className="chip bad">Escalated to manager</span>}
          </div>
        </div>
        <div className="row">
          {lead && !lead.dnd && telLink(lead.phone) && <a className="btn" href={telLink(lead.phone)}><Icon name="phone" size={15} /> Call</a>}
          {lead && !lead.dnd && waLink(lead.phone) && <a className="btn gold" href={waLink(lead.phone)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {lead?.email && <a className="btn ghost" href={`mailto:${lead.email}?subject=${encodeURIComponent(d.title)}`}><Icon name="mail" size={15} /> Email</a>}
        </div>
      </div>

      <div className="grid">
        <div className="panel ledger"><div className="kpi-label">Value</div><div className="kpi" style={{ fontSize: 22 }}>{d.value_inr ? lakh(d.value_inr) : "—"}</div></div>
        <div className="panel ledger"><div className="kpi-label">Next step</div><div className="kpi" style={{ fontSize: 18 }}>{isOpen ? d.next_action || "Not set" : "Closed"}</div>
          {isOpen && left !== null && <div className="small" style={{ color: left < 0 ? "var(--blood)" : undefined }}>{left < 0 ? `${-left} d overdue` : left === 0 ? "Due today" : `by ${fmtDate(d.next_action_at)}`}</div>}</div>
        <div className="panel ledger"><div className="kpi-label">Stage</div><div className="kpi" style={{ fontSize: 22 }}>{stage[d.stage]}</div><div className="small faint">{d.stage === "lost" ? d.lost_reason || "" : `${Math.max(idx, 0) + 1} of ${STAGES.length - 1}`}</div></div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm">
          {canWrite && (
            <div className="panel">
              <h3>Log what happened</h3>
              <LogActivity leadId={d.lead_id} dealId={d.id} defaultKind="meeting" />
            </div>
          )}
          <div className="panel"><h3>Timeline</h3><Timeline items={acts} name={name} /></div>
        </div>
        <div className="panel">
          <h3>Deal</h3>
          {canWrite ? (
            <FormState action={updateDeal}>
              <input type="hidden" name="id" value={d.id} />
              <div><label htmlFor="title">Title</label><input id="title" name="title" defaultValue={d.title} required maxLength={200} /></div>
              <div className="form-grid">
                <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={d.stage}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><label htmlFor="value_inr">Value (₹)</label><input id="value_inr" name="value_inr" inputMode="numeric" defaultValue={d.value_inr || ""} /></div>
                {["admin", "manager", "bid_preparer"].includes(role) ? <OwnerSelect members={sellers} me={user.id} value={d.owner_id} /> : <input type="hidden" name="owner_id" value={d.owner_id || ""} />}
              </div>
              <div className="form-grid">
                <div><label htmlFor="next_action">Next step</label><input id="next_action" name="next_action" defaultValue={d.next_action || ""} maxLength={120} /></div>
                <div><label htmlFor="next_at">By</label><input id="next_at" name="next_at" type="date" defaultValue={toDate(d.next_action_at)} /></div>
              </div>
              <div><label htmlFor="lost_reason">If lost, why</label><input id="lost_reason" name="lost_reason" defaultValue={d.lost_reason || ""} maxLength={200} placeholder="Price, went with competitor, no budget…" /></div>
              <div><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={4} defaultValue={d.notes || ""} /></div>
            </FormState>
          ) : <p className="small" style={{ whiteSpace: "pre-wrap" }}>{d.notes || "No notes."}</p>}
          <p className="tiny faint" style={{ marginBottom: 0 }}>
            <Link href={`/app/tasks?link_type=deal&link_id=${d.id}&link_label=${encodeURIComponent(d.title.slice(0, 80))}&title=${encodeURIComponent(("Follow up: " + d.title).slice(0, 200))}`}>Assign a task on this deal</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
