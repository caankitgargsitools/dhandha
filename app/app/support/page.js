import Link from "next/link";
import { getContext } from "@/lib/session";
import { CATEGORIES, STATUS, PRIORITY, ago } from "@/lib/tickets";
import FormState from "../FormState";
import { openTicket } from "./actions";

export default async function Support() {
  const { supabase, tenant } = await getContext();
  const { data: tickets } = await supabase.from("tickets").select("*").eq("tenant_id", tenant.id).order("last_reply_at", { ascending: false });
  const active = (tickets || []).filter((t) => !["resolved", "closed"].includes(t.status));
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Help & tickets</h1><p>Raise a ticket and the Dhandha team replies here. Most tickets get a first reply within 4 working hours.</p></div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel flush">
          <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Your tickets</h3><span className="faint small">{active.length} open</span></div>
          {!tickets?.length && <p className="muted small" style={{ padding: "0 22px 20px" }}>No tickets yet. Use the form to ask anything.</p>}
          {(tickets || []).map((t) => {
            const [sc, sl] = STATUS[t.status], [pc, pl] = PRIORITY[t.priority];
            return (
              <Link key={t.id} href={`/app/support/${t.id}`} style={{ display: "block", padding: "14px 22px", borderTop: "1px solid var(--line-soft)", color: "inherit" }}>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <strong>{t.subject}</strong>
                  <span className={`chip ${sc}`}>{sl}</span>
                </div>
                <div className="row tiny faint" style={{ gap: 10, marginTop: 4 }}>
                  <span>#{t.number}</span><span>{CATEGORIES[t.category]}</span><span className={`chip plain ${pc}`}>{pl}</span><span>updated {ago(t.last_reply_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="panel">
          <h3>Raise a ticket</h3>
          <FormState action={openTicket} submit="Send ticket">
            <div><label htmlFor="subject">Subject</label><input id="subject" name="subject" required maxLength={140} placeholder="e.g. Bid pack shows a document as missing" /></div>
            <div className="form-grid">
              <div><label htmlFor="category">About</label>
                <select id="category" name="category" defaultValue="tenders">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label htmlFor="priority">How urgent?</label>
                <select id="priority" name="priority" defaultValue="normal"><option value="low">Low — a question</option><option value="normal">Normal</option><option value="high">High — work is slowed</option><option value="urgent">Urgent — a bid deadline is at risk</option></select></div>
            </div>
            <div><label htmlFor="body">Details</label><textarea id="body" name="body" rows={6} required placeholder="What happened, which tender or document, and what you expected." /></div>
          </FormState>
        </div>
      </div>
    </div>
  );
}
