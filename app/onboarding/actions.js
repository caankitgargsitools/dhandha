"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(prev, formData) {
  const supabase = await createClient();
  const kind = formData.get("kind") === "firm" ? "firm" : "business";
  const company = String(formData.get("company") || "").trim();
  const tenantName = kind === "firm" ? String(formData.get("firm_name") || "").trim() : company;
  if (!company) return { error: "Please enter the company name." };
  const { error } = await supabase.rpc("create_workspace", {
    p_tenant_name: tenantName || company,
    p_kind: kind,
    p_company_name: company,
  });
  if (error) return { error: error.message };
  redirect("/app/tenders/preferences?welcome=1");
}
