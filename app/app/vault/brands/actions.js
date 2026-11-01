"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { slugKey } from "@/lib/oem";

const s = (v) => String(v ?? "").trim().slice(0, 300);
const blocked = (role) => role === "viewer" || role === "disabled";

// Brands (OEMs) the firm is authorised to sell and what it supplied each year: kept as Vault facts (lib/oem.js).
export async function saveOem(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (blocked(role)) return { error: "You have view-only access." };
  const brand = s(formData.get("brand"));
  if (!brand) return { error: "The brand name is needed." };
  const { error } = await supabase.from("company_facts").upsert({
    tenant_id: tenant.id, company_id: company.id, key: `oem.${slugKey(brand)}`, period: "",
    value: JSON.stringify({ brand, products: s(formData.get("products")), auth_no: s(formData.get("auth_no")) }),
    unit: "oem", valid_until: s(formData.get("valid_until")) || null, source: "user",
  }, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  revalidatePath("/app/vault/brands");
  return { message: `Saved ${brand}.` };
}

export async function saveSupply(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (blocked(role)) return { error: "You have view-only access." };
  const product = s(formData.get("product")), period = s(formData.get("period")), qty = Number(String(formData.get("qty") || "").replace(/[,\s]/g, ""));
  if (!product || !period) return { error: "Product and financial year are needed." };
  if (!(qty > 0)) return { error: "Quantity must be a number above 0." };
  const { error } = await supabase.from("company_facts").upsert({
    tenant_id: tenant.id, company_id: company.id, key: `supply.${slugKey(product)}`, period,
    value: JSON.stringify({ product, qty, unit: s(formData.get("unit")), buyer: s(formData.get("buyer")) }),
    unit: "supply", source: "user",
  }, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  revalidatePath("/app/vault/brands");
  return { message: `Saved ${product} for ${period}.` };
}

export async function removeEntry(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (blocked(role)) return { error: "You have view-only access." };
  const id = s(formData.get("id"));
  const { error } = await supabase.from("company_facts").delete().eq("id", id).eq("company_id", company.id).or("key.like.oem.%,key.like.supply.%");
  if (error) return { error: error.message };
  revalidatePath("/app/vault/brands");
  return { message: "Removed." };
}
