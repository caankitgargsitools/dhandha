import Link from "next/link";
import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import FormState from "../../FormState";
import CopyField from "./CopyField";
import { saveWidget } from "./actions";

export const metadata = { title: "Website chat & enquiry form" };

export default async function Website() {
  const { supabase, company, role } = await getContext();
  const h = await headers();
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const isLead = ["admin", "manager"].includes(role);
  const [{ data: w }, { data: recent }] = await Promise.all([
    supabase.from("web_widgets").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("leads").select("id, name, contact_person, created_at").eq("company_id", company.id).eq("source", "website").order("created_at", { ascending: false }).limit(10),
  ]);
  const snippet = w ? `<script src="${origin}/w/${w.token}.js" async></script>` : "";

  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Website chat &amp; enquiry form</h1><p>A chat button on your own website: visitors leave their name, number and question — it becomes a lead with a phone alert, gets an owner and starts your playbook. No website? Share your enquiry link instead. Free.</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Settings</h3>
          {!isLead ? <p className="small muted">Ask an admin or manager to set this up.</p> : (
            <FormState action={saveWidget} submit={w ? "Save" : "Create my widget"}>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="enabled" defaultChecked={w ? w.enabled : true} style={{ width: "auto" }} />Switched on</label>
              <div><label htmlFor="w-title">Title</label><input id="w-title" name="title" maxLength={60} defaultValue={w?.title || "Talk to us"} /></div>
              <div><label htmlFor="w-greet">Greeting</label><textarea id="w-greet" name="greeting" rows={2} maxLength={300} defaultValue={w?.greeting || "Hi! Leave your number and we will call you back shortly."} /></div>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: "0 0 110px" }}><label htmlFor="w-color">Colour</label><input id="w-color" name="color" type="color" defaultValue={w?.color || "#4f46e5"} style={{ height: 40, padding: 2 }} /></div>
                <div style={{ flex: 1 }}><label htmlFor="w-wa">WhatsApp number (optional)</label><input id="w-wa" name="whatsapp" inputMode="tel" defaultValue={w?.whatsapp || ""} placeholder="98100 12345" /></div>
              </div>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="ask_email" defaultChecked={w ? w.ask_email : true} style={{ width: "auto" }} />Ask for email too</label>
              <div><label htmlFor="w-dom">Only on these websites (optional)</label><input id="w-dom" name="domains" defaultValue={(w?.domains || []).join(", ")} placeholder="yourfirm.in" /><div className="tiny faint">Leave empty to allow any site. Stops others from copying your button.</div></div>
            </FormState>
          )}
        </div>
        <div className="stack">
          {w ? (
            <div className="panel stack-sm">
              <div className="row between"><h3 style={{ margin: 0 }}>Put it on your website</h3><span className={`chip ${w.leads ? "ok" : "mute"}`}>{w.leads ? `${w.leads} enquiries · last ${fmtDate(w.last_lead_at)}` : "No enquiries yet"}</span></div>
              <CopyField label="Paste before </body> on every page (WordPress: Appearance → Theme file editor → footer.php, or a “header and footer scripts” plugin; Wix / Shopify: custom code)" value={snippet} />
              <CopyField label="Your enquiry link — for WhatsApp, Instagram bio, Google profile or a QR code on your visiting card" value={`${origin}/f/${w.token}`} />
              <div><a className="btn ghost sm" href={`/f/${w.token}`} target="_blank" rel="noreferrer">Open the enquiry page</a></div>
            </div>
          ) : <div className="panel small muted">Create the widget on the left to get your line of code and enquiry link.</div>}
          <div className="panel">
            <h3>Latest website enquiries</h3>
            {!(recent || []).length ? <p className="small muted" style={{ margin: 0 }}>None yet.</p> : (recent || []).map((l) => <div key={l.id} className="small row between" style={{ padding: "4px 0" }}><Link href={`/app/leads/${l.id}`}>{l.contact_person || l.name}</Link><span className="faint">{fmtDate(l.created_at)}</span></div>)}
            <p className="tiny faint" style={{ marginBottom: 0 }}>Bots are filtered with a hidden field and a limit of 5 enquiries an hour from one network.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
