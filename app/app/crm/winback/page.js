import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { saveWinback } from "./actions";

export const metadata = { title: "Win-back & referrals" };

export default async function Winback() {
  const { supabase, company, role } = await getContext();
  const [{ data: s }, { data: books }, { data: refs }, { data: referred }] = await Promise.all([
    supabase.from("winback_settings").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("sequences").select("id, name").eq("company_id", company.id).order("created_at"),
    supabase.from("referral_links").select("referrals, leads(id, name)").eq("company_id", company.id).gt("referrals", 0).order("referrals", { ascending: false }).limit(20),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("source", "referral"),
  ]);
  const canEdit = ["admin", "manager"].includes(role);
  return (
    <div className="stack">
      <div className="page-head"><div><Link href="/app/crm" className="small">← CRM pipeline</Link><h1>Win-back &amp; referrals</h1>
        <p>Business you already earned is the cheapest business to get more of: ask happy customers for referrals, check in with quiet ones, and go back to deals you lost.</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h3>Win-back</h3>
          <FormState action={saveWinback} submit="Save">
            <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }} className="stack-sm">
              <label>Status<select name="enabled" defaultValue={s?.enabled ? "1" : "0"}><option value="1">On</option><option value="0">Off</option></select></label>
              <label>Go back to a lost deal after (days)<input type="number" name="lost_days" min={7} max={730} defaultValue={s?.lost_days || 90} /></label>
              <label>Check in with a customer quiet for (days)<input type="number" name="idle_days" min={30} max={1095} defaultValue={s?.idle_days || 180} /></label>
              <label>Also start this playbook for lost deals (optional)
                <select name="sequence_id" defaultValue={s?.sequence_id || ""}><option value="">No — just a task for the owner</option>{(books || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <p className="tiny faint" style={{ margin: 0 }}>Checked every morning. Each lost deal or quiet customer gets one task for its owner (and the playbook, if chosen) — never repeated.</p>
            </fieldset>
          </FormState>
        </div>
        <div className="panel">
          <h3>Referrals</h3>
          <p className="small">Every customer you win gets a task 14 days later to ask for a referral, with their own link. Open any customer&apos;s lead page → <strong>Referral link</strong> to copy it or send it on WhatsApp. Referred people arrive as leads (source &quot;Referral&quot;) with a thank-you task for you.</p>
          <p className="small" style={{ margin: 0 }}><strong>{referred?.count ?? 0}</strong> referred leads so far.</p>
          {(refs || []).length > 0 && (
            <table className="small" style={{ marginTop: 10 }}><thead><tr><th>Top referrers</th><th>Referrals</th></tr></thead>
              <tbody>{refs.map((r, i) => <tr key={i}><td>{r.leads ? <Link href={`/app/leads/${r.leads.id}`}>{r.leads.name}</Link> : "—"}</td><td>{r.referrals}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
