import Link from "next/link";
import { getContext, daysLeft, inr } from "@/lib/session";

const CORE_DOCS = ["REG-PAN", "REG-GST", "REG-INC", "FIN-AUDIT", "FIN-ITR", "EXP-CC"];
const CORE_FIELDS = ["legal_name", "constitution", "pan", "gstin", "registered_address", "state", "pincode", "email", "phone", "signatory_name", "signatory_designation", "bank_account", "bank_ifsc"];

export default async function Dashboard() {
  const { supabase, tenant, company } = await getContext();
  const [{ data: c }, { data: docs }, { data: wallet }, { data: brand }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("documents").select("id, type_code, title, valid_until, document_types(name)").eq("company_id", company.id),
    supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("brand_assets").select("kind").eq("company_id", company.id),
  ]);
  const fieldsDone = CORE_FIELDS.filter((f) => c?.[f]).length;
  const docCodes = new Set((docs || []).map((d) => d.type_code));
  const docsDone = CORE_DOCS.filter((d) => docCodes.has(d)).length;
  const brandKinds = new Set((brand || []).map((b) => b.kind));
  const brandDone = ["letterhead", "signature", "seal"].filter((k) => brandKinds.has(k)).length;
  const total = CORE_FIELDS.length + CORE_DOCS.length + 3;
  const pct = Math.round(((fieldsDone + docsDone + brandDone) / total) * 100);
  const expiring = (docs || [])
    .filter((d) => d.valid_until && daysLeft(d.valid_until) <= 60)
    .sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until));

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="grid">
        <div className="panel">
          <div className="muted small">Vault complete</div>
          <div className="stat">{pct}%</div>
          <div className="muted small">{fieldsDone}/{CORE_FIELDS.length} profile fields · {docsDone}/{CORE_DOCS.length} core documents · {brandDone}/3 letterhead, signature, seal</div>
        </div>
        <div className="panel">
          <div className="muted small">Credits</div>
          <div className="stat">{inr(wallet?.balance)}</div>
          <Link href="/app/wallet" className="small">See usage and plan</Link>
        </div>
        <div className="panel">
          <div className="muted small">Documents expiring in 60 days</div>
          <div className="stat">{expiring.length}</div>
          <Link href="/app/vault/documents" className="small">Open documents</Link>
        </div>
      </div>

      {pct < 100 && (
        <div className="panel">
          <h3>Finish your Vault</h3>
          <p className="muted small">Everything entered here is reused in every tender and proposal, so you are never asked twice.</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {fieldsDone < CORE_FIELDS.length && <li><Link href="/app/vault/profile">Complete the company profile</Link></li>}
            {CORE_DOCS.filter((d) => !docCodes.has(d)).length > 0 && (
              <li><Link href="/app/vault/documents">Add core documents</Link>: {CORE_DOCS.filter((d) => !docCodes.has(d)).join(", ")}</li>
            )}
            {brandDone < 3 && <li><Link href="/app/brand">Upload letterhead, signature and seal</Link></li>}
          </ul>
        </div>
      )}

      {expiring.length > 0 && (
        <div className="panel">
          <h3>Renew soon</h3>
          <table>
            <thead><tr><th>Document</th><th>Valid until</th><th>Status</th></tr></thead>
            <tbody>
              {expiring.map((d) => {
                const left = daysLeft(d.valid_until);
                return (
                  <tr key={d.id}>
                    <td>{d.title || d.document_types?.name}</td>
                    <td>{new Date(d.valid_until).toLocaleDateString("en-IN")}</td>
                    <td><span className={`chip ${left < 0 ? "bad" : left <= 15 ? "bad" : "warn"}`}>{left < 0 ? `Expired ${-left} days ago` : `${left} days left`}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
