import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { saveProfile } from "../../actions";

const STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

function F({ name, label, c, type = "text", ...rest }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={c?.[name] ?? ""} {...rest} />
    </div>
  );
}

export default async function Profile({ searchParams }) {
  const params = await searchParams;
  const { supabase, company, role } = await getContext();
  const { data: c } = await supabase.from("companies").select("*").eq("id", company.id).single();
  const readOnly = role === "viewer";
  return (
    <div className="stack">
      <div>
        <h1>Company profile</h1>
        <p className="muted" style={{ margin: 0 }}>Entered once, used in every bid, annexure and proposal.</p>
      </div>
      {params?.welcome && <p className="notice small">Welcome! Your trial is active with 500 credits. Start by filling in the company details below.</p>}
      <FormState action={saveProfile} submit="Save profile">
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <div className="panel stack">
            <h3>Identity</h3>
            <div className="form-grid">
              <F name="legal_name" label="Legal name" c={c} required />
              <F name="trade_name" label="Trade name" c={c} />
              <div>
                <label htmlFor="constitution">Constitution</label>
                <select id="constitution" name="constitution" defaultValue={c?.constitution ?? ""}>
                  <option value="">Select</option>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership firm</option>
                  <option value="llp">LLP</option>
                  <option value="private_limited">Private limited</option>
                  <option value="public_limited">Public limited</option>
                  <option value="opc">One person company</option>
                  <option value="trust">Trust</option>
                  <option value="society">Society</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <F name="incorporation_date" label="Date of incorporation / start" c={c} type="date" />
              <F name="pan" label="PAN" c={c} maxLength={10} placeholder="ABCDE1234F" />
              <F name="gstin" label="GSTIN" c={c} maxLength={15} placeholder="07ABCDE1234F1Z5" />
              <F name="cin" label="CIN / LLPIN" c={c} />
              <F name="udyam_no" label="Udyam registration no." c={c} placeholder="UDYAM-XX-00-0000000" />
              <div>
                <label htmlFor="msme_category">MSME category</label>
                <select id="msme_category" name="msme_category" defaultValue={c?.msme_category ?? ""}>
                  <option value="">Not registered</option>
                  <option value="micro">Micro</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </div>
          </div>
          <div className="panel stack">
            <h3>Address and contact</h3>
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="registered_address">Registered address</label>
                <textarea id="registered_address" name="registered_address" rows={2} defaultValue={c?.registered_address ?? ""} />
              </div>
              <F name="city" label="City" c={c} />
              <div>
                <label htmlFor="state">State / UT</label>
                <select id="state" name="state" defaultValue={c?.state ?? ""}>
                  <option value="">Select</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <F name="pincode" label="Pincode" c={c} maxLength={6} inputMode="numeric" />
              <F name="email" label="Official email" c={c} type="email" />
              <F name="phone" label="Official phone" c={c} />
              <F name="website" label="Website" c={c} />
            </div>
          </div>
          <div className="panel stack">
            <h3>Authorised signatory</h3>
            <div className="form-grid">
              <F name="signatory_name" label="Name" c={c} />
              <F name="signatory_designation" label="Designation" c={c} placeholder="Director / Partner / Proprietor" />
              <F name="signatory_mobile" label="Mobile (for signature OTP)" c={c} inputMode="tel" />
            </div>
          </div>
          <div className="panel stack">
            <h3>Bank account (for EMD refunds and payments)</h3>
            <div className="form-grid">
              <F name="bank_name" label="Bank and branch" c={c} />
              <F name="bank_account" label="Account number" c={c} inputMode="numeric" />
              <F name="bank_ifsc" label="IFSC" c={c} maxLength={11} />
            </div>
          </div>
        </fieldset>
      </FormState>
    </div>
  );
}
