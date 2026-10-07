import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, fmtDate } from "@/lib/session";
import { CATEGORIES, STATUS, PRIORITY, ago } from "@/lib/tickets";
import FormState from "../../FormState";
import { replyTicket, closeTicket } from "../actions";

export default async function TicketPage({ params }) {
  const { id } = await params;
  const { supabase, tenant } = await getContext();
  const { data: t } = await supabase.from("tickets").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at");
  const [sc, sl] = STATUS[t.status], [pc, pl] = PRIORITY[t.priority];
  return (
    <div className="stack">
      <Link href="/app/support" className="small">All tickets</Link>
      <div className="page-head">
        <div>
          <h1>{t.subject}</h1>
          <div className="row small faint" style={{ gap: 10 }}>
            <span>#{t.number}</span><span className={`chip ${sc}`}>{sl}</span><span className={`chip ${pc}`}>{pl}</span>
            <span>{CATEGORIES[t.category]}</span><span>opened {fmtDate(t.created_at)}</span>
          </div>
        </div>
        {t.status !== "closed" && (
          <form action={closeTicket}><input type="hidden" name="ticket_id" value={t.id} /><button className="ghost sm">Close ticket</button></form>
        )}
      </div>
      <div className="thread">
        {(msgs || []).map((m) => (
          <div key={m.id} className={`msg${m.is_staff ? " staff" : ""}`}>
            <div className="meta">{m.is_staff ? "Dhandha support" : "You"} · {ago(m.created_at)}</div>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
      {t.status !== "closed" ? (
        <div className="panel">
          <FormState action={replyTicket} submit="Send reply">
            <input type="hidden" name="ticket_id" value={t.id} />
            <div><label htmlFor="body">Your reply</label><textarea id="body" name="body" rows={4} required /></div>
          </FormState>
        </div>
      ) : <p className="muted small">This ticket is closed. Raise a new one if you need more help.</p>}
    </div>
  );
}
