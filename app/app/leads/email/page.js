import Link from "next/link";
import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import { KeyAndScript, Settings } from "./EmailSetup";

// Email enquiries → leads (C42). A small script in the firm's own Gmail sends each new email here every 5 minutes;
// people writing in become leads (automatic mail skipped), a reply from an existing lead is noted on it and stops its
// playbook. Free.
export default async function EmailLeads() {
  const { supabase, company, isAdmin } = await getContext();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const [{ data: hook }, { data: leads }] = await Promise.all([
    supabase.from("email_hooks").select("token, created_at, last_at, leads, repeats, skipped, last_skip, own_domains, enabled").eq("company_id", company.id).maybeSingle(),
    supabase.from("leads").select("id, name, contact_person, email, created_at").eq("company_id", company.id).eq("source", "website").like("notes", "Email enquiry:%").order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Email enquiries</h1><p>Everyone who writes to your business email becomes a lead with a phone alert — newsletters, no-reply mail and your own team are skipped. Free.</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <div className="row between"><h3 style={{ margin: 0 }}>Connection</h3><span className={`chip ${hook?.last_at ? "ok" : hook ? "warn" : "mute"}`}>{hook?.last_at ? `${hook.leads} new lead${hook.leads === 1 ? "" : "s"} · last ${fmtDate(hook.last_at)}` : hook ? "Waiting for the first email" : "Not set up"}</span></div>
          {hook && <p className="small muted" style={{ margin: 0 }}>{hook.repeats} replies from existing leads · {hook.skipped} automatic emails skipped{hook.last_skip ? ` (last: ${hook.last_skip})` : ""}{hook.enabled ? "" : " · paused"}</p>}
          {isAdmin ? <KeyAndScript origin={origin} token={hook?.token} connected={!!hook} /> : <p className="small muted">Ask the workspace admin to set this up.</p>}
          {isAdmin && hook && <Settings ownDomains={hook.own_domains} enabled={hook.enabled} />}
        </div>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Set it up in Gmail (5 minutes)</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Press <strong>Create my Gmail script</strong> and copy it.</li>
            <li>Signed in to the Gmail that receives enquiries, open <strong>script.google.com</strong> → <strong>New project</strong>. Delete what is there and paste.</li>
            <li>Press <strong>Save</strong>, choose <strong>setup</strong> in the function list and press <strong>Run</strong>. Allow access when Google asks (the script runs in your own Google account).</li>
            <li>Done — every 5 minutes new inbox emails come here and get the label “Dhandha” in Gmail.</li>
          </ol>
          <p className="tiny faint" style={{ margin: 0 }}>Only the Primary inbox of the last 2 days is read; each email is sent once. Leads show under “Website” in Results by source. Outlook or other mail: send the same JSON from any tool that can call a web address.</p>
        </div>
      </div>
      <div className="panel flush table-wrap">
        <div className="panel-head" style={{ padding: "14px 16px 0" }}><h3>Latest email enquiries</h3></div>
        <table>
          <thead><tr><th>When</th><th>Lead</th><th>Contact</th><th>Email</th></tr></thead>
          <tbody>
            {!leads?.length && <tr><td colSpan={4} className="small muted">None yet.</td></tr>}
            {(leads || []).map((l) => <tr key={l.id}><td>{fmtDate(l.created_at)}</td><td><Link href={`/app/leads/${l.id}`}>{l.name}</Link></td><td>{l.contact_person || "—"}</td><td>{l.email}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
