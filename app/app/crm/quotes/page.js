import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";

export const metadata = { title: "Quotations" };
const ST = { draft: ["mute", "Draft"], sent: ["info", "Sent"], accepted: ["ok", "Accepted"], declined: ["bad", "Declined"], expired: ["warn", "Expired"] };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default async function Quotes() {
  const { supabase, company } = await getContext();
  const { data: list } = await supabase.from("quotes").select("id, number, client_name, subject, status, totals, created_at, viewed_at, responded_at").eq("company_id", company.id).order("created_at", { ascending: false }).limit(200);
  const won = (list || []).filter((q) => q.status === "accepted");
  return (
    <div className="stack">
      <div className="page-head">
        <div><Link href="/app/crm" className="small">← CRM pipeline</Link><h1>Quotations</h1>
          <p>Quotations on your letterhead with GST worked out. Send the client a link: they see it, accept or decline online, and the deal moves by itself.</p></div>
        <Link href="/app/crm/quotes/new" className="btn">New quotation</Link>
      </div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Quotations</div><div className="kpi">{(list || []).length}</div></div>
        <div className="panel ledger"><div className="kpi-label">Accepted</div><div className="kpi">{won.length}</div><div className="faint small">{inr(won.reduce((s, q) => s + Number(q.totals?.total || 0), 0))}</div></div>
        <div className="panel ledger"><div className="kpi-label">Waiting for the client</div><div className="kpi">{(list || []).filter((q) => q.status === "sent").length}</div></div>
      </div>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Quotation</th><th>Client</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {!(list || []).length && <tr><td colSpan={4} className="muted" style={{ padding: 18 }}>No quotations yet.</td></tr>}
            {(list || []).map((q) => (
              <tr key={q.id}>
                <td><Link href={`/app/crm/quotes/${q.id}`}><strong>{q.number}</strong></Link><div className="tiny faint">{fmtDate(q.created_at)}{q.subject ? ` · ${q.subject}` : ""}</div></td>
                <td>{q.client_name}</td>
                <td>{inr(q.totals?.total)}</td>
                <td><span className={`chip ${ST[q.status][0]}`}>{ST[q.status][1]}</span>{q.status === "sent" && <div className="tiny faint">{q.viewed_at ? `Seen ${fmtDate(q.viewed_at)}` : "Not opened yet"}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
