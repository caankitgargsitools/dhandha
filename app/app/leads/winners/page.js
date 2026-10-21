import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import Icon from "@/components/Icon";
import FormState from "../../FormState";
import OwnerSelect from "@/components/OwnerSelect";
import { PACKS } from "@/lib/leads";
import { addWinners, saveWinnerPrefs } from "../actions";

export default async function Winners() {
  const { supabase, tenant, company, user, role } = await getContext();
  const [{ data: pref }, { data: rows, error }, { data: price }, { data: wallet }, { data: members }] = await Promise.all([
    supabase.from("lead_preferences").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.rpc("winner_prospects", { p_company: company.id }),
    supabase.from("price_book").select("credits").eq("action_code", "lead_found").maybeSingle(),
    supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
  ]);
  const list = rows || [];
  const cost = Number(price?.credits ?? 0);
  const isLead = ["admin", "manager"].includes(role);
  const canWrite = role !== "viewer";
  const sellers = (members || []).filter((m) => ["admin", "manager", "telecaller", "field"].includes(m.role));
  const where = [...(pref?.cities || []), ...(pref?.states || [])].join(", ") || "all of India";

  return (
    <div className="stack">
      <Link href="/app/leads" className="small">All leads</Link>
      <div className="page-head">
        <div>
          <h1>Tender winners</h1>
          <p>Firms that recently won government tenders in {where}, read from award-of-contract results on public portals by Dhandha&apos;s own crawler. Fresh contract wins need finance, audit, supplies, equipment and staff.</p>
        </div>
      </div>
      {!pref && <div className="notice"><Icon name="map" /><span>Set your <Link href="/app/leads">ideal client</Link> cities and states first, so only winners near you show up.</span></div>}

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(260px, 1fr)", alignItems: "start" }}>
        <div className="stack-sm">
          {error && <p className="error">{error.message}</p>}
          {!list.length ? (
            <div className="panel"><p className="muted" style={{ margin: 0 }}>No new winners match right now. Award results arrive as the crawler reads the portals; widen the work types or period on the right to see more.</p></div>
          ) : (
            <FormState action={addWinners} submit={`Add selected as leads${cost ? ` · ${cost} credits each` : ""}`}>
              <div className="panel flush table-wrap">
                <table>
                  <thead><tr><th aria-label="Select" /><th>Firm</th><th>Latest win</th><th>Value</th><th>Wins</th></tr></thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.award_id}>
                        <td><input type="checkbox" name="award" value={a.award_id} aria-label={`Add ${a.bidder_name}`} style={{ width: "auto" }} /></td>
                        <td><strong>{a.bidder_name}</strong><div className="tiny faint">{[a.bidder_city, a.state].filter(Boolean).join(", ")}</div><div className="tiny faint">{PACKS[a.industry_pack] || ""}</div></td>
                        <td className="small">{a.title}<div className="tiny faint">{a.authority} · {a.portal} · {fmtDate(a.contract_date)}</div></td>
                        <td className="num small">{a.awarded_value ? lakh(a.awarded_value) : "—"}</td>
                        <td className="small">{a.wins}{a.wins > 1 && a.total_value ? <div className="tiny faint">{lakh(a.total_value)} total</div> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isLead && <div style={{ maxWidth: 320 }}><OwnerSelect members={sellers} me={user.id} blank="Leave unassigned" /></div>}
              <p className="tiny faint" style={{ margin: 0 }}>
                {list.length} firms · wallet {Number(wallet?.balance || 0).toLocaleString("en-IN")} credits. Award notices give the firm&apos;s name and address but rarely a phone number; each lead has a quick link to look up its contact.
              </p>
            </FormState>
          )}
        </div>

        <div className="panel">
          <h3>Which winners</h3>
          {isLead && canWrite ? (
            <FormState action={saveWinnerPrefs}>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small" style={{ fontWeight: 700 }}>Kind of work won</legend>
                {Object.entries(PACKS).map(([k, l]) => (
                  <label key={k} className="row small" style={{ gap: 8 }}><input type="checkbox" name="packs" value={k} defaultChecked={(pref?.winner_packs || []).includes(k)} style={{ width: "auto" }} />{l}</label>
                ))}
                <div className="tiny faint">None ticked = all kinds.</div>
              </fieldset>
              <div><label htmlFor="min_value">Smallest contract (₹)</label><input id="min_value" name="min_value" inputMode="numeric" defaultValue={pref?.winner_min_value || ""} placeholder="e.g. 2500000" /></div>
              <div><label htmlFor="days">Won in the last</label>
                <select id="days" name="days" defaultValue={String(pref?.winner_days || 180)}>{[30, 90, 180, 365, 730].map((d) => <option key={d} value={d}>{d < 365 ? `${d} days` : `${d / 365} year${d > 365 ? "s" : ""}`}</option>)}</select></div>
            </FormState>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>{(pref?.winner_packs || []).map((p) => PACKS[p]).join(", ") || "All kinds of work"} · last {pref?.winner_days || 180} days. Your manager can change this.</p>
          )}
          <p className="tiny faint" style={{ marginBottom: 0 }}>Location comes from your ideal client cities and states on the Leads page.</p>
        </div>
      </div>
    </div>
  );
}
