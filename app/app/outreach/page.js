import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";
import Icon from "@/components/Icon";
import FormState from "../FormState";
import { emailReady } from "@/lib/outreach";
import { createSequence } from "./actions";

const MSG = { queued: ["info", "Queued"], sending: ["warn", "Sending"], sent: ["ok", "Sent"], failed: ["bad", "Failed"], skipped: ["mute", "Skipped"] };

export default async function Outreach() {
  const { supabase, tenant, company, role } = await getContext();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: seqs }, { data: enr }, { data: msgs }, { data: settings }] = await Promise.all([
    supabase.from("sequences").select("id, name, active, created_at, sequence_steps(id, channel)").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("enrollments").select("sequence_id, status").eq("company_id", company.id),
    supabase.from("outreach_messages").select("id, channel, to_addr, subject, wa_template, status, error, created_at, leads(id, name)").eq("company_id", company.id).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    supabase.from("outreach_settings").select("wa_connected_at").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const count = (id, st) => (enr || []).filter((e) => e.sequence_id === id && (!st || e.status === st)).length;
  const sent = (msgs || []).filter((m) => m.status === "sent");
  const isLead = ["admin", "manager"].includes(role);
  const email = emailReady(), wa = !!settings?.wa_connected_at;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Outreach</h1><p>Email and WhatsApp sequences that follow up for you, step by step, and stop by themselves when a call or meeting is logged.</p></div>
        <Link href="/app/outreach/settings" className="btn ghost">Sender settings</Link>
      </div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Sent in 30 days</div><div className="kpi">{sent.length}</div><div className="faint small">{sent.filter((m) => m.channel === "email").length} email · {sent.filter((m) => m.channel === "whatsapp").length} WhatsApp</div></div>
        <div className="panel ledger"><div className="kpi-label">Leads in sequences</div><div className="kpi">{(enr || []).filter((e) => e.status === "active").length}</div><div className="faint small">{(enr || []).filter((e) => e.status === "replied").length} replied</div></div>
        <div className="panel">
          <h3 style={{ fontSize: 15 }}>Channels</h3>
          <ul className="reasons">
            <li><Icon name={email ? "check" : "alert"} size={14} /><span>Email {email ? "is on" : "switches on once Dhandha's mail service is configured"}</span></li>
            <li><Icon name={wa ? "check" : "alert"} size={14} /><span>WhatsApp {wa ? "is connected" : <>needs your WhatsApp Business number: <Link href="/app/outreach/settings">connect it</Link></>}</span></li>
          </ul>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Sequence</th><th>Steps</th><th>Active</th><th>Replied</th><th>Done</th></tr></thead>
            <tbody>
              {!(seqs || []).length && <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>No sequences yet.</td></tr>}
              {(seqs || []).map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/app/outreach/${s.id}`}><strong>{s.name}</strong></Link>{!s.active && <span className="chip mute" style={{ marginLeft: 8 }}>Off</span>}
                    <div className="tiny faint">{s.sequence_steps.map((x) => (x.channel === "email" ? "Email" : "WhatsApp")).join(" → ")}</div></td>
                  <td>{s.sequence_steps.length}</td><td>{count(s.id, "active")}</td><td>{count(s.id, "replied")}</td><td>{count(s.id, "completed")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLead && (
          <div className="panel">
            <h3>New sequence</h3>
            <FormState action={createSequence} submit="Create">
              <div><label htmlFor="name">Name</label><input id="name" name="name" required maxLength={120} placeholder="e.g. New companies — audit offer" /></div>
            </FormState>
            <p className="tiny faint" style={{ marginBottom: 0 }}>Messages can use {"{name}"} (first name), {"{business}"}, {"{city}"} and {"{our_company}"}. Every email carries your company name and an unsubscribe link; do-not-disturb and unsubscribed leads are never messaged.</p>
          </div>
        )}
      </div>

      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>When</th><th>Lead</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>
            {!(msgs || []).length && <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>Nothing sent in the last 30 days.</td></tr>}
            {(msgs || []).slice(0, 50).map((m) => (
              <tr key={m.id}>
                <td className="small">{fmtDate(m.created_at)}</td>
                <td className="small">{m.leads ? <Link href={`/app/leads/${m.leads.id}`}>{m.leads.name}</Link> : "—"}<div className="tiny faint">{m.to_addr}</div></td>
                <td className="small">{m.channel === "email" ? m.subject : `WhatsApp: ${m.wa_template}`}</td>
                <td><span className={`chip ${MSG[m.status][0]}`}>{MSG[m.status][1]}</span>{m.error && <div className="tiny faint">{m.error}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
