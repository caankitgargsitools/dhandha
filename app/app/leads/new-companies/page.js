import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import Icon from "@/components/Icon";
import FormState from "../../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { addMcaCompanies, saveMcaPrefs } from "../actions";

export default async function NewCompanies() {
  const { supabase, tenant, company, user, role } = await getContext();
  const [{ data: pref }, { data: rows, error }, { data: price }, { data: wallet }, { data: members }] = await Promise.all([
    supabase.from("lead_preferences").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.rpc("mca_prospects", { p_company: company.id }),
    supabase.from("price_book").select("credits").eq("action_code", "lead_found").maybeSingle(),
    supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
  ]);
  const list = rows || [];
  const cost = Number(price?.credits ?? 0);
  const isLead = ["admin", "manager"].includes(role);
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const where = [...(pref?.cities || []), ...(pref?.states || [])].join(", ") || "all of India";
  const what = (pref?.industries || []).join(", ") || "any line of business";

  return (
    <div className="stack">
      <Link href="/app/leads" className="small">All leads</Link>
      <div className="page-head">
        <div>
          <h1>New companies</h1>
          <p>Companies and LLPs registered in the last {pref?.mca_days || 60} days in {where}, doing {what}, from the Ministry of Corporate Affairs&apos; public registration data. New businesses need accounts, compliance, premises, software, staff and suppliers.</p>
        </div>
      </div>
      {!pref && list.length > 0 && <div className="notice"><Icon name="map" /><span>Set your <Link href="/app/leads">ideal client</Link> industries, cities and states first, so only relevant new companies show up.</span></div>}

      <div className="grid-main">
        <div className="stack-sm">
          {error && <p className="error">{error.message}</p>}
          {!list.length && !pref ? (
            <div className="panel stack-sm"><h3 style={{ margin: 0 }}>Save your ideal client first</h3><p className="muted small" style={{ margin: 0 }}>Tell Dhandha your ideal client&apos;s industries, cities and states, so Dhandha can pick the new companies that suit you.</p><div><Link className="btn" href="/app/leads">Set your ideal client</Link></div></div>
          ) : !list.length ? (
            <div className="panel"><p className="muted" style={{ margin: 0 }}>No new registrations match right now. The register is refreshed every month; widen the period or industries to see more.</p></div>
          ) : (
            <FormState action={addMcaCompanies} submit={`Add selected as leads${cost ? ` · ${cost} credits each` : ""}`}>
              <div className="panel flush table-wrap">
                <table>
                  <thead><tr><th aria-label="Select" /><th>Company</th><th>Business</th><th>Registered</th><th>Paid-up</th></tr></thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.cin}>
                        <td><input type="checkbox" name="cin" value={m.cin} aria-label={`Add ${m.name}`} style={{ width: "auto" }} /></td>
                        <td><strong>{m.name}</strong><div className="tiny faint">{m.address || m.state}</div>{m.has_email && <div className="tiny"><Icon name="mail" size={11} /> email on record</div>}</td>
                        <td className="small">{m.activity || "—"}<div className="tiny faint">{m.kind === "llp" ? "LLP" : m.class || "Company"}</div></td>
                        <td className="small">{fmtDate(m.incorporated_on)}</td>
                        <td className="num small">{m.paid_up_capital ? lakh(m.paid_up_capital) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isLead && <div style={{ maxWidth: 320 }}><OwnerSelect members={sellers} me={user.id} blank="Leave unassigned" /></div>}
              <p className="tiny faint" style={{ margin: 0 }}>{list.length} companies · wallet {Number(wallet?.balance || 0).toLocaleString("en-IN")} credits. The registered office address and email (where MCA has one) are copied into the lead.</p>
            </FormState>
          )}
        </div>

        <div className="panel">
          <h3>Which companies</h3>
          {isLead ? (
            <FormState action={saveMcaPrefs}>
              <div><label htmlFor="days">Registered in the last</label>
                <select id="days" name="days" defaultValue={String(pref?.mca_days || 60)}>{[15, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}</select></div>
              <div><label htmlFor="min_capital">Smallest paid-up capital (₹)</label><input id="min_capital" name="min_capital" inputMode="numeric" defaultValue={pref?.mca_min_capital || ""} placeholder="e.g. 500000" /></div>
            </FormState>
          ) : <p className="small muted" style={{ margin: 0 }}>Last {pref?.mca_days || 60} days. Your manager can change this.</p>}
          <p className="tiny faint" style={{ marginBottom: 0 }}>Industries and places come from your ideal client on the Leads page.</p>
        </div>
      </div>
    </div>
  );
}
