"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { checkField, lastFys } from "@/lib/masters";
import { BUYERS, currentFy } from "@/lib/masterPlan";

const COMPANY_FIELDS = new Set(["legal_name", "constitution", "pan", "gstin", "registered_address", "incorporation_date", "signatory_name", "signatory_designation", "bank_account", "bank_ifsc", "udyam_no"]);
const blocked = (role) => role === "viewer" || role === "disabled";
const done = () => { revalidatePath("/app/vault/masters"); revalidatePath("/app/vault"); return { message: "Saved — next one below." }; };

// One answer on the tender-ready checklist → the company record or a Vault fact (asked once, used by every tender).
export async function saveMasterItem(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (blocked(role)) return { error: "You have view-only access." };
  const kind = String(formData.get("kind") || "");
  if (kind === "buyers") {
    const keys = formData.getAll("buyers").map(String).filter((k) => BUYERS.some((b) => b.key === k));
    if (!keys.length) return { error: "Tick at least one." };
    const { error } = await supabase.from("company_facts").upsert({ tenant_id: tenant.id, company_id: company.id, key: "profile.buyers", period: "", value: JSON.stringify(keys), unit: "buyers", source: "user" }, { onConflict: "company_id,key,period" });
    return error ? { error: error.message } : done();
  }
  if (kind === "company") {
    const field = String(formData.get("field") || "");
    if (!COMPANY_FIELDS.has(field)) return { error: "Unknown field." };
    const r = checkField(field, String(formData.get("value") ?? ""));
    if (r.error) return { error: r.error };
    const { error } = await supabase.from("companies").update({ [field]: r.value }).eq("id", company.id);
    return error ? { error: error.message } : done();
  }
  if (kind === "turnover") {
    const rows = [];
    for (const [k, v] of formData.entries()) {
      if (!k.startsWith("fy:") || String(v).trim() === "") continue;
      const n = Number(String(v).replace(/[,₹\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) return { error: `Turnover for ${k.slice(3)} should be a number in rupees.` };
      rows.push({ tenant_id: tenant.id, company_id: company.id, key: "fin.turnover", period: k.slice(3).slice(0, 20), value: String(Math.round(n)), unit: "INR", source: "user" });
    }
    if (!rows.length) return { error: "Type at least one year's turnover." };
    const { error } = await supabase.from("company_facts").upsert(rows, { onConflict: "company_id,key,period" });
    return error ? { error: error.message } : done();
  }
  if (kind === "fact") {
    const key = String(formData.get("key") || "");
    if (!/^(reg\.[a-z_]{2,40}|fin\.net_worth)$/.test(key)) return { error: "Unknown question." };
    let value = String(formData.get("value") ?? "").trim().slice(0, 300);
    if (!value) return { error: "Type an answer." };
    if (key === "fin.net_worth") { const n = Number(value.replace(/[,₹\s]/g, "")); if (!Number.isFinite(n)) return { error: "Net worth should be a number in rupees." }; value = String(Math.round(n)); }
    // GeM profile turnover is asked again each financial year; net worth is stored per FY, like the tender assistant does
    const period = key === "reg.gem_profile_turnover" ? currentFy() : key === "fin.net_worth" ? lastFys()[0] : "";
    const { error } = await supabase.from("company_facts").upsert({ tenant_id: tenant.id, company_id: company.id, key, period, value, unit: key === "fin.net_worth" ? "INR" : null, source: "user" }, { onConflict: "company_id,key,period" });
    return error ? { error: error.message } : done();
  }
  return { error: "Unknown answer." };
}
