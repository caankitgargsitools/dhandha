import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";
import FormState from "../../FormState";
import { emailReady } from "@/lib/outreach";
import { saveOutreachSettings, disconnectWhatsApp } from "../actions";

export default async function OutreachSettings() {
  const { supabase, tenant, company, isAdmin, user } = await getContext();
  const { data: s } = await supabase.from("outreach_settings").select("*").eq("tenant_id", tenant.id).maybeSingle();
  return (
    <div className="stack">
      <Link href="/app/outreach" className="small">Outreach</Link>
      <div className="page-head"><div><h1>Sender settings</h1><p>How your emails and WhatsApp messages appear to the people you reach.</p></div></div>
      {!isAdmin && <p className="small muted">Only the workspace admin can change these.</p>}
      <FormState action={saveOutreachSettings} submit="Save">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel stack-sm">
            <h3>Email</h3>
            {!emailReady() && <p className="notice small" style={{ margin: 0 }}>Email sending switches on once Dhandha&apos;s mail service is configured.</p>}
            <div><label htmlFor="from_name">Sender name</label><input id="from_name" name="from_name" defaultValue={s?.from_name || ""} placeholder={company.legal_name} maxLength={80} disabled={!isAdmin} /></div>
            <div><label htmlFor="reply_to">Replies go to</label><input id="reply_to" name="reply_to" type="email" defaultValue={s?.reply_to || ""} placeholder={user.email} disabled={!isAdmin} /></div>
            <p className="tiny faint" style={{ margin: 0 }}>Emails are sent from Dhandha&apos;s mail service with your name; replies land in your own inbox. Each email carries your company name, address and an unsubscribe link.</p>
          </div>
          <div className="panel stack-sm">
            <h3>WhatsApp Business</h3>
            <p className="small" style={{ margin: 0 }}>{s?.wa_connected_at ? <>Connected {fmtDate(s.wa_connected_at)}{s.wa_display_number ? ` · ${s.wa_display_number}` : ""}</> : "Not connected"}</p>
            <div><label htmlFor="wa_display_number">Business number</label><input id="wa_display_number" name="wa_display_number" defaultValue={s?.wa_display_number || ""} placeholder="+91 98xxxxxxxx" disabled={!isAdmin} /></div>
            <div><label htmlFor="wa_phone_number_id">Phone number ID</label><input id="wa_phone_number_id" name="wa_phone_number_id" defaultValue={s?.wa_phone_number_id || ""} inputMode="numeric" disabled={!isAdmin} /></div>
            <div><label htmlFor="wa_token">Permanent access token</label><input id="wa_token" name="wa_token" type="password" autoComplete="off" placeholder={s?.wa_connected_at ? "Saved — enter a new one to replace it" : "From your Meta system user"} disabled={!isAdmin} /></div>
            <p className="tiny faint" style={{ margin: 0 }}>From Meta Business → WhatsApp Manager → API setup. The token is stored encrypted and is never shown again. Messages go from your own number using your approved templates, and only to leads who agreed to hear from you on WhatsApp (tick &quot;WhatsApp opt-in&quot; on the lead). Meta bills your WhatsApp account for conversations.</p>
          </div>
        </div>
      </FormState>
      {isAdmin && s?.wa_connected_at && <form action={disconnectWhatsApp}><button className="danger">Disconnect WhatsApp</button></form>}
    </div>
  );
}
