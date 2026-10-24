import Link from "next/link";
import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import KeyBox from "./KeyBox";

// Google Ads lead forms → Leads. People searching for your service in your area tap your ad and fill a form;
// Google sends the form here within seconds; the lead gets a CRM deal and your sequence like any other.
export default async function GoogleAds() {
  const { supabase, company, isAdmin } = await getContext();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const [{ data: hook }, { data: leads }] = await Promise.all([
    supabase.from("google_ads_hooks").select("token, created_at, last_lead_at, leads, tests").eq("company_id", company.id).maybeSingle(),
    supabase.from("leads").select("id, name, contact_person, city, created_at").eq("company_id", company.id).eq("source", "google_ads").order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Google Ads lead forms</h1><p>Reach people who are searching for what you sell, in the areas you choose — their form lands in your leads within seconds, free in Dhandha (you pay Google for the ads).</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <div className="row between"><h3 style={{ margin: 0 }}>Connection</h3><span className={`chip ${hook?.last_lead_at ? "ok" : hook ? "warn" : "mute"}`}>{hook?.last_lead_at ? `${hook.leads} lead${hook.leads === 1 ? "" : "s"} · last ${fmtDate(hook.last_lead_at)}` : hook ? "Waiting for the first lead" : "Not set up"}</span></div>
          {hook?.tests > 0 && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>✓ Google's test lead arrived — the connection works.</p>}
          {isAdmin ? <KeyBox origin={origin} token={hook?.token} connected={!!hook} /> : <p className="small muted">Ask the workspace admin to set this up.</p>}
        </div>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Set it up in Google Ads (10 minutes)</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Create a <strong>Search</strong> campaign. Under <strong>Locations</strong>, pick your city or draw a radius, and choose “People <em>in</em> or regularly in your locations”.</li>
            <li>Add keywords people type when they need you, e.g. “chartered accountant noida”, “GST registration near me”.</li>
            <li>Add a <strong>Lead form</strong> asset: ask for name, phone, email, city — and one question that qualifies them.</li>
            <li>In the lead form, open <strong>Lead delivery → Webhook integration</strong>. Paste the <strong>Webhook URL</strong> and <strong>Key</strong> from the left.</li>
            <li>Press <strong>Send test data</strong>. A test lead appears here and in your leads.</li>
          </ol>
          <p className="tiny faint" style={{ margin: 0 }}>Each lead gets a deal at “New lead”, joins the autopilot's message sequence if one is set, and counts under “Google Ads form” in Results by source.</p>
        </div>
      </div>
      <div className="panel flush table-wrap">
        <div className="panel-head" style={{ padding: "14px 16px 0" }}><h3>Latest Google Ads leads</h3></div>
        <table>
          <thead><tr><th>When</th><th>Lead</th><th>Contact</th><th>City</th></tr></thead>
          <tbody>
            {!leads?.length && <tr><td colSpan={4} className="small muted">None yet.</td></tr>}
            {(leads || []).map((l) => <tr key={l.id}><td>{fmtDate(l.created_at)}</td><td><Link href={`/app/leads/${l.id}`}>{l.name}</Link></td><td>{l.contact_person || "—"}</td><td>{l.city || "—"}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
