import Link from "next/link";
import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { GST_RATES } from "@/lib/quote";
import { saveItem } from "./actions";

export const metadata = { title: "Price list" };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function ItemForm({ item, submit }) {
  return (
    <FormState action={saveItem} submit={submit} className="stack-sm">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="form-grid">
        <div><label>Name</label><input name="name" required maxLength={200} defaultValue={item?.name || ""} placeholder="e.g. GST return filing (monthly)" /></div>
        <div><label>HSN / SAC</label><input name="hsn" maxLength={12} defaultValue={item?.hsn || ""} placeholder="998221" /></div>
        <div><label>Unit</label><input name="unit" maxLength={12} defaultValue={item?.unit || ""} placeholder="month / job / nos" /></div>
        <div><label>Rate (₹, before GST)</label><input name="rate" inputMode="numeric" defaultValue={item?.rate ?? ""} /></div>
        <div><label>GST</label><select name="gst" defaultValue={String(item?.gst ?? 18)}>{GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}</select></div>
      </div>
      <div><label>Description (optional, printed after the name)</label><input name="description" maxLength={500} defaultValue={item?.description || ""} /></div>
      {item && <label className="row small" style={{ gap: 8 }}><input type="hidden" name="active" value="false" /><input type="checkbox" name="active" value="true" defaultChecked={item.active} style={{ width: "auto" }} />In use (untick to hide from quotations and invoices)</label>}
    </FormState>
  );
}

// The firm's price list: products / services with HSN/SAC, unit, rate and GST — quotation and invoice lines fill from it.
export default async function Catalog() {
  const { supabase, company, role } = await getContext();
  const { data: items } = await supabase.from("catalog_items").select("*").eq("company_id", company.id).order("active", { ascending: false }).order("name");
  const lead = ["admin", "manager"].includes(role);
  return (
    <div className="stack">
      <Link href="/app/crm/quotes" className="small">Quotations</Link>
      <div className="page-head"><div><h1>Price list</h1><p>Your products and services with HSN/SAC, unit, rate and GST. In a quotation or invoice, pick from the list and the line fills itself — same prices every time.</p></div></div>
      <div className="grid-main">
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Item</th><th>HSN/SAC</th><th>Unit</th><th>Rate</th><th>GST</th></tr></thead>
            <tbody>
              {!(items || []).length && <tr><td colSpan={5} className="muted small">Nothing yet — add your first item.</td></tr>}
              {(items || []).map((i) => (
                <tr key={i.id} style={{ opacity: i.active ? 1 : 0.5 }}>
                  <td className="small">{lead ? <details><summary><strong>{i.name}</strong>{!i.active && " (hidden)"}</summary><div style={{ marginTop: 8 }}><ItemForm item={i} submit="Save" /></div></details> : <strong>{i.name}</strong>}{i.description && <div className="tiny faint">{i.description}</div>}</td>
                  <td className="small">{i.hsn || "—"}</td><td className="small">{i.unit || "—"}</td><td className="num small">{inr(i.rate)}</td><td className="small">{i.gst}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lead ? <div className="panel"><h3>Add an item</h3><ItemForm submit="Add" /></div> : <div className="panel small muted">Admins and managers keep the price list.</div>}
      </div>
    </div>
  );
}
