import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import { createFeed, revokeFeed } from "./actions";

export const metadata = { title: "Google Sheets & Excel" };

const LABEL = { tenders: "Your tenders", leads: "Your leads" };

export default async function Sheets() {
  const { supabase, company, role } = await getContext();
  const h = await headers();
  // the live address, not a preview's, so a pasted link keeps working
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const isLead = ["admin", "manager"].includes(role);
  const { data: feeds } = isLead ? await supabase.from("data_feeds").select("*").eq("company_id", company.id).is("revoked_at", null).order("created_at") : { data: [] };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Google Sheets &amp; Excel</h1>
          <p>A live sheet of your tenders or leads that updates by itself — share it with your team or partners, filter and chart it, without anyone logging in to Dhandha.</p>
        </div>
      </div>
      {!isLead ? (
        <div className="notice">Only admins and managers can create sheet links.</div>
      ) : (
        <>
          <div className="panel">
            <h3>How to use</h3>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Create a link below for tenders or leads.</li>
              <li><strong>Google Sheets:</strong> in cell A1 type <code>=IMPORTDATA("the link")</code>. Google refreshes it about every hour.</li>
              <li><strong>Excel:</strong> Data → From Web → paste the link → Load. Use Refresh All to update.</li>
            </ol>
            <p className="tiny faint" style={{ marginBottom: 0 }}>Anyone who has a link can read that sheet, so share it only with people you trust. Switch a link off below at any time; it stops working at once.</p>
          </div>
          <div className="panel flush table-wrap">
            <table>
              <thead><tr><th>Sheet</th><th>Link and formula</th><th>Used</th><th /></tr></thead>
              <tbody>
                {!(feeds || []).length && <tr><td colSpan={4} className="muted" style={{ padding: 18 }}>No links yet.</td></tr>}
                {(feeds || []).map((f) => {
                  const url = `${origin}/api/feed/${f.token}`;
                  return (
                    <tr key={f.token}>
                      <td><strong>{LABEL[f.kind]}</strong><div className="tiny faint">Made {fmtDate(f.created_at)}</div></td>
                      <td className="small" style={{ wordBreak: "break-all" }}><input readOnly value={url} style={{ fontSize: 12 }} /><div className="tiny faint" style={{ marginTop: 4 }}>Google Sheets: <code>=IMPORTDATA("{url}")</code></div></td>
                      <td className="small">{f.uses ? <>{f.uses} times<div className="tiny faint">last {fmtDate(f.last_used_at)}</div></> : "Not yet"}</td>
                      <td><form action={revokeFeed}><input type="hidden" name="token" value={f.token} /><SubmitButton className="ghost sm" confirm="Switch this link off? Sheets using it stop updating.">Switch off</SubmitButton></form></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <form action={createFeed}><input type="hidden" name="kind" value="tenders" /><SubmitButton>New link: tenders</SubmitButton></form>
            <form action={createFeed}><input type="hidden" name="kind" value="leads" /><SubmitButton className="ghost">New link: leads</SubmitButton></form>
          </div>
        </>
      )}
    </div>
  );
}
