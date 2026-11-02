import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { oemsFrom, suppliesFrom, PRODUCT_CERTS } from "@/lib/oem";
import { saveOem, saveSupply, removeEntry } from "./actions";

const fy = () => { const d = new Date(), y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `FY ${y - 1}-${String(y).slice(2)}`; };

// For resellers and suppliers: the brands you may sell (GeM asks for the OEM's authorisation) and how much of each
// product you supplied each year (GeM's past-performance test). Asked once, checked on every GeM bid.
export default async function Brands() {
  const { supabase, company, role } = await getContext();
  const { data: facts } = await supabase.from("company_facts").select("id, key, period, value, valid_until").eq("company_id", company.id).or("key.like.oem.%,key.like.supply.%");
  const oems = oemsFrom(facts || []), supplies = suppliesFrom(facts || []).sort((a, b) => a.product.localeCompare(b.product) || b.period.localeCompare(a.period));
  const edit = role !== "viewer";
  const Remove = ({ id }) => edit && <FormState action={removeEntry} submit="Remove" buttonClass="ghost sm" className="row"><input type="hidden" name="id" value={id} /></FormState>;
  return (
    <div className="stack">
      <div><h1>Brands & supplies</h1>
        <p className="muted" style={{ margin: 0 }}>For resellers and suppliers. GeM bids often ask for the maker&apos;s (OEM&apos;s) authorisation and proof that you supplied a share of the quantity in one of the last 3 years. Add them once; every GeM bid is checked against them.</p></div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Brands you are authorised to sell</h3>
          {oems.length ? (
            <div className="table-wrap"><table style={{ fontSize: 13 }}>
              <thead><tr><th>Brand</th><th>Products</th><th>Authorisation</th><th></th></tr></thead>
              <tbody>{oems.map((o) => <tr key={o.id}><td><strong>{o.brand}</strong></td><td className="small">{o.products || "—"}{!!o.certs?.length && <div className="tiny faint">{o.certs.map((k) => PRODUCT_CERTS.find((c) => c.key === k)?.label.split(" (")[0]).filter(Boolean).join(" · ")}</div>}</td><td className="small">{o.auth_no || "—"}{o.valid_until && <div className="tiny faint">valid till {String(o.valid_until).slice(0, 10)}</div>}</td><td><Remove id={o.id} /></td></tr>)}</tbody>
            </table></div>
          ) : <p className="muted small">No brands yet.</p>}
          {edit && (
            <FormState action={saveOem} submit="Save brand">
              <div className="form-grid">
                <div><label htmlFor="brand">Brand (OEM)</label><input id="brand" name="brand" required placeholder="e.g. HP" /></div>
                <div><label htmlFor="products">Products</label><input id="products" name="products" placeholder="laptops, desktops, printers" /></div>
                <div><label htmlFor="auth_no">Authorisation no. / dealer code</label><input id="auth_no" name="auth_no" /></div>
                <div><label htmlFor="valid_until">Valid till</label><input id="valid_until" name="valid_until" type="date" /></div>
              </div>
              <fieldset className="row" style={{ border: 0, padding: 0, margin: 0, flexWrap: "wrap", gap: 12 }}><legend className="small muted">Product certificates you hold for this brand</legend>
                {PRODUCT_CERTS.map((c) => <label key={c.key} className="small row" style={{ gap: 4 }}><input type="checkbox" name="certs" value={c.key} />{c.label}</label>)}
              </fieldset>
            </FormState>
          )}
          <div className="tiny faint">Upload the authorisation letter itself in Vault → Documents.</div>
        </div>

        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>What you supplied each year</h3>
          {supplies.length ? (
            <div className="table-wrap"><table style={{ fontSize: 13 }}>
              <thead><tr><th>Product</th><th>Year</th><th className="right">Quantity</th><th>Main buyer</th><th></th></tr></thead>
              <tbody>{supplies.map((x) => <tr key={x.id}><td>{x.product}</td><td>{x.period}</td><td className="right num">{Number(x.qty).toLocaleString("en-IN")} {x.unit}</td><td className="small">{x.buyer || "—"}</td><td><Remove id={x.id} /></td></tr>)}</tbody>
            </table></div>
          ) : <p className="muted small">Nothing yet.</p>}
          {edit && (
            <FormState action={saveSupply} submit="Save supply">
              <div className="form-grid">
                <div><label htmlFor="product">Product</label><input id="product" name="product" required placeholder="e.g. Desktop computers" /></div>
                <div><label htmlFor="period">Financial year</label><input id="period" name="period" required defaultValue={fy()} /></div>
                <div><label htmlFor="qty">Quantity supplied</label><input id="qty" name="qty" inputMode="numeric" required /></div>
                <div><label htmlFor="unit">Unit</label><input id="unit" name="unit" placeholder="nos, kg, sets…" /></div>
                <div><label htmlFor="buyer">Main buyer (government / PSU)</label><input id="buyer" name="buyer" /></div>
              </div>
            </FormState>
          )}
          <div className="tiny faint">Same product and year again = update. Keep the supply orders / invoices in Documents as proof.</div>
        </div>
      </div>
    </div>
  );
}
