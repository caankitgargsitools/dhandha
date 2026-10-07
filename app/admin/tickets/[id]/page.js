import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { fmtDate } from "@/lib/session";
import { CATEGORIES, STAFF_STATUS, PRIORITY, ago } from "@/lib/tickets";
import FormState from "@/app/app/FormState";
import { staffReply, setPriority } from "../../actions";

export default async function AdminTicket({ params }) {
  const { id } = await params;
  const { supabase } = await getAdminContext();
  const { data: t } = await supabase.from("tickets").select("*, tenants(id, name), companies(legal_name)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: msgs }, { data: opener }] = await Promise.all([
    supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("profiles").select("full_name, email, phone").eq("id", t.created_by).maybeSingle(),
  ]);
  return (
    <div className="stack">
      <Link href="/admin/tickets" className="small">Ticket queue</Link>
      <div className="page-head">
        <div>
          <h1>{t.subject}</h1>
          <div className="row small faint" style={{ gap: 10 }}>
            <span>#{t.number}</span><span className={`chip ${STAFF_STATUS[t.status][0]}`}>{STAFF_STATUS[t.status][1]}</span>
            <span>{CATEGORIES[t.category]}</span><span>opened {fmtDate(t.created_at)}</span>
          </div>
        </div>
        <form action={setPriority} className="row" style={{ gap: 8 }}>
          <input type="hidden" name="ticket_id" value={t.id} />
          <select name="priority" defaultValue={t.priority} aria-label="Priority" style={{ width: "auto" }}>{Object.entries(PRIORITY).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="ghost sm">Set priority</button>
        </form>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="thread">
            {(msgs || []).map((m) => (
              <div key={m.id} className={`msg${m.is_staff ? " staff" : ""}`}>
                <div className="meta">{m.is_staff ? "Dhandha support" : opener?.full_name || "Customer"} · {ago(m.created_at)}</div>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          <div className="panel">
            <FormState action={staffReply} submit="Send">
              <input type="hidden" name="ticket_id" value={t.id} />
              <div><label htmlFor="body">Reply to customer</label><textarea id="body" name="body" rows={5} /></div>
              <div style={{ maxWidth: 280 }}><label htmlFor="status">Then set status to</label>
                <select id="status" name="status" defaultValue="in_progress">
                  <option value="in_progress">In progress</option><option value="waiting_on_customer">Waiting on customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </select></div>
            </FormState>
          </div>
        </div>
        <div className="panel stack-sm">
          <h3>Customer</h3>
          <div><Link href={`/admin/tenants/${t.tenants?.id}`}><strong>{t.tenants?.name}</strong></Link><div className="small faint">{t.companies?.legal_name}</div></div>
          <div className="small">{opener?.full_name}<div className="faint">{opener?.email}</div>{opener?.phone && <div className="faint">{opener.phone}</div>}</div>
          <div className="small faint">Priority: {PRIORITY[t.priority][1]} · last activity {ago(t.last_reply_at)}</div>
        </div>
      </div>
    </div>
  );
}
