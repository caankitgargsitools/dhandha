import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { importLeads } from "../actions";

// LinkedIn connections as leads, through LinkedIn's own data export (no scraping).
export default async function LinkedIn() {
  const { supabase, company, role } = await getContext();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("source", "linkedin");
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>LinkedIn</h1><p>Your LinkedIn connections become leads for {company.legal_name}: name, company, position and profile link, scored on fit. Free.</p></div></div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>1. Download your connections from LinkedIn</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>On LinkedIn, open <strong>Me → Settings &amp; Privacy → Data privacy → Get a copy of your data</strong>.</li>
          <li>Choose <strong>Connections</strong> only and request the archive. LinkedIn emails it, usually within 10 minutes.</li>
          <li>Unzip it; you need the file <strong>Connections.csv</strong>.</li>
        </ol>
      </div>
      {role !== "viewer" && (
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>2. Upload Connections.csv</h3>
          <FormState action={importLeads} submit="Import connections">
            <input type="file" name="file" accept=".csv,text/csv" required aria-label="Connections.csv" />
            <input type="hidden" name="source" value="linkedin" />
          </FormState>
          <p className="tiny faint" style={{ margin: 0 }}>People already in Leads (same profile link) are skipped, so you can upload a fresh export any time. LinkedIn does not share phone numbers or emails in this export unless your connections allowed it.</p>
        </div>
      )}
      <div className="panel row between">
        <span className="small">{count ? `${count} LinkedIn connections are in your Leads.` : "No LinkedIn connections imported yet."}</span>
        {count ? <Link className="btn sm ghost" href="/app/leads?source=linkedin">See them in Leads</Link> : null}
      </div>
    </div>
  );
}
