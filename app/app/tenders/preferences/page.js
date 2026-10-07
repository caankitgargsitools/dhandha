import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { savePreferences } from "../bidActions";
import ServicePicker from "@/components/ServicePicker";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"];

export default async function Preferences({ searchParams }) {
  const params = await searchParams;
  const { supabase, company, role } = await getContext();
  const { data: p } = await supabase.from("tender_preferences").select("*").eq("company_id", company.id).maybeSingle();
  const lakhs = (v) => (v ? String(v / 1e5) : "");
  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">Tenders</Link>
      <div className="page-head"><div><h1>What {company.legal_name} does</h1><p>Pick your industries and the exact services you offer. Dhandha uses this to find tenders (and later, leads) for you, then scores each one against your Vault.</p></div></div>
      {params?.welcome && <div className="notice small"><span><strong>Welcome!</strong> Start by telling Dhandha what you do — it takes a minute. Next, fill in your <Link href="/app/vault/profile">company profile</Link>.</span></div>}
      <FormState action={savePreferences} submit="Save and re-score">
        <fieldset disabled={role === "viewer"} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <div className="panel stack-sm">
            <h3>Industry, sub-industry and services</h3>
            <ServicePicker initial={p?.services || []} />
            <div className="form-grid">
              <div><label htmlFor="keywords">Also match these words (comma separated)</label><input id="keywords" name="keywords" defaultValue={(p?.custom_keywords || []).join(", ")} placeholder="Anything specific to you, e.g. dredging, kiosk" /></div>
              <div><label htmlFor="exclude_keywords">Never show tenders with</label><input id="exclude_keywords" name="exclude_keywords" defaultValue={(p?.exclude_keywords || []).join(", ")} placeholder="bridge, dredging" /></div>
            </div>
          </div>
          <div className="panel stack-sm">
            <h3>Where</h3>
            <p className="tiny faint" style={{ margin: 0 }}>Leave all unticked to see every state.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {STATES.map((s) => (
                <label key={s} className="row" style={{ gap: 8, margin: 0, color: "var(--ink)", fontWeight: 500 }}>
                  <input type="checkbox" name="states" value={s} defaultChecked={(p?.states || []).includes(s)} style={{ width: 16, height: 16 }} />{s}
                </label>
              ))}
            </div>
          </div>
          <div className="panel stack-sm">
            <h3>Size and timing</h3>
            <div className="form-grid">
              <div><label htmlFor="min_value">Smallest tender (₹ lakh)</label><input id="min_value" name="min_value" inputMode="decimal" defaultValue={lakhs(p?.min_value)} /><input type="hidden" name="min_value_unit" value="lakh" /></div>
              <div><label htmlFor="max_value">Largest tender (₹ lakh)</label><input id="max_value" name="max_value" inputMode="decimal" defaultValue={lakhs(p?.max_value)} /><input type="hidden" name="max_value_unit" value="lakh" /></div>
              <div><label htmlFor="max_emd">Highest EMD you can give (₹ lakh)</label><input id="max_emd" name="max_emd" inputMode="decimal" defaultValue={lakhs(p?.max_emd)} /><input type="hidden" name="max_emd_unit" value="lakh" /></div>
              <div><label htmlFor="min_days_left">Hide tenders closing within (days)</label><input id="min_days_left" name="min_days_left" type="number" min={0} max={30} defaultValue={p?.min_days_left ?? 5} /></div>
            </div>
          </div>
        </fieldset>
      </FormState>
    </div>
  );
}
