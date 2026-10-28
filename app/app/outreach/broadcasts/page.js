import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";
import { SOURCES } from "@/lib/leads";
import Composer from "./Composer";

export const metadata = { title: "WhatsApp broadcasts" };

export default async function Broadcasts() {
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: list }, { data: settings }] = await Promise.all([
    supabase.from("broadcasts").select("id, name, wa_template, total, created_at, outreach_messages(status)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("outreach_settings").select("wa_connected_at").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const isLead = ["admin", "manager"].includes(role);
  const by = (b, s) => (b.outreach_messages || []).filter((m) => m.status === s).length;
  return (
    <div className="stack">
      <Link href="/app/outreach" className="small">← Outreach</Link>
      <div className="page-head"><div><h1>WhatsApp broadcasts</h1><p>Send one approved WhatsApp template to a chosen group of your leads — festival greetings, an offer, a reminder. Only leads who opted in get it; replies come into the WhatsApp inbox.</p></div></div>
      {!settings?.wa_connected_at && <div className="notice">Connect your WhatsApp Business number first: <Link href="/app/outreach/settings">Outreach → Sender settings</Link>.</div>}
      {isLead ? <Composer sources={SOURCES} /> : <p className="small muted">Admins and managers send broadcasts.</p>}
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Broadcast</th><th>Leads</th><th>Sent</th><th>Waiting</th><th>Failed</th></tr></thead>
          <tbody>
            {!(list || []).length && <tr><td colSpan={5} className="muted" style={{ padding: 18 }}>No broadcasts yet.</td></tr>}
            {(list || []).map((b) => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong><div className="tiny faint">{b.wa_template} · {fmtDate(b.created_at)}</div></td>
                <td>{b.total}</td><td>{by(b, "sent")}</td><td>{by(b, "queued") + by(b, "sending")}</td><td>{by(b, "failed")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
