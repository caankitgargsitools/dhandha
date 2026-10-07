import { getAdminContext } from "@/lib/admin";
import FormState from "@/app/app/FormState";
import { savePrice, saveModule } from "../actions";

export default async function AdminPricing() {
  const { supabase } = await getAdminContext();
  const [{ data: modules }, { data: prices }] = await Promise.all([
    supabase.from("modules").select("*").order("sort"),
    supabase.from("price_book").select("*").order("module_code"),
  ]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Pricing</h1><p>Changes apply immediately to every customer. Monthly fees exclude GST; 1 credit = ₹1.</p></div></div>
      <div className="panel">
        <h3>Module fees</h3>
        <div className="stack-sm">
          {(modules || []).map((m) => (
            <FormState key={m.code} action={saveModule} submit="Save" className="row">
              <input type="hidden" name="code" value={m.code} />
              <strong style={{ width: 160 }}>{m.name}</strong>
              <div style={{ width: 150 }}><label>Monthly fee ₹</label><input name="fee" defaultValue={m.monthly_fee_inr} inputMode="decimal" /></div>
              <div style={{ width: 150 }}><label>Credits included</label><input name="credits" defaultValue={m.included_credits} inputMode="decimal" /></div>
            </FormState>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Pay-as-you-go rates</h3>
        <div className="stack-sm">
          {(prices || []).map((p) => (
            <FormState key={p.action_code} action={savePrice} submit="Save" className="row">
              <input type="hidden" name="action_code" value={p.action_code} />
              <div style={{ flex: 1, minWidth: 220 }}><strong>{p.name}</strong><div className="tiny faint">{p.module_code} · per {p.unit}</div></div>
              <div style={{ width: 130 }}><label>Credits</label><input name="credits" defaultValue={p.credits} inputMode="decimal" /></div>
            </FormState>
          ))}
        </div>
      </div>
    </div>
  );
}
