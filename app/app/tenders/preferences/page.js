import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { savePreferences } from "../bidActions";
import ServicePicker from "@/components/ServicePicker";
import WordChips from "@/components/WordChips";
import { loadCatalog } from "@/lib/catalog";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"];

export default async function Preferences({ searchParams }) {
  const params = await searchParams;
  const { supabase, company, tenant, role } = await getContext();
  const [{ data: p }, { tree }] = await Promise.all([
    supabase.from("tender_preferences").select("*").eq("company_id", company.id).maybeSingle(),
    loadCatalog(supabase, tenant.id),
  ]);
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
            <ServicePicker initial={p?.services || []} tree={tree} />
            <div className="form-grid" style={{ alignItems: "start" }}>
              <WordChips name="keywords" label="Also match these words" initial={p?.custom_keywords || []} placeholder="e.g. kiosk, valuation + land|property"
                hint={<>Type a word and press Add. To stay precise, add “+” and words that must also appear: <em>certification + chartered|utilisation|net worth</em>.</>} empty="No extra words." />
              <WordChips name="exclude_keywords" label="Never show tenders with" initial={p?.exclude_keywords || []} placeholder="e.g. bridge, dredging" empty="Nothing blocked." />
            </div>
            {p?.muted?.length > 0 && (
              <WordChips name="muted" label="Words you switched off with × on the Tenders page (remove one to switch it back on)" initial={p.muted} placeholder="switch off another word" />
            )}
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
          <div className="panel stack-sm">
            <h3>AI tender check</h3>
            <label className="row" style={{ gap: 10, margin: 0, fontWeight: 500, alignItems: "flex-start", flexWrap: "nowrap" }}>
              <input type="checkbox" name="ai_check" defaultChecked={!!p?.ai_check} style={{ width: "auto", marginTop: 3 }} />
              <span>After the word match, AI reads what each new tender is actually for and hides the ones that are not your work (you can bring any back). Free AI first; 0.1 credit (₹0.10) a tender. Only the tender's public text and your service names are sent.</span>
            </label>
          </div>
        </fieldset>
      </FormState>
    </div>
  );
}
