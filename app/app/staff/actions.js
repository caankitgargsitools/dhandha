"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { payLine, activeIn, runTotals } from "@/lib/payroll";

const t = (v, n = 120) => String(v || "").trim().slice(0, n) || null;
const num = (v) => { const n = Number(String(v || "").replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : 0; };

export async function saveStaff(prev, fd) {
  const { supabase, tenant, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin manages staff and pay." };
  const name = t(fd.get("name"));
  if (!name) return { error: "Name is needed." };
  const row = {
    name, designation: t(fd.get("designation")), phone: t(fd.get("phone"), 20), email: t(fd.get("email")),
    joined_on: fd.get("joined_on") || null, left_on: fd.get("left_on") || null,
    gross: num(fd.get("gross")), basic_pct: Math.min(100, num(fd.get("basic_pct")) || 50), pf: fd.get("pf") === "on", esi: fd.get("esi") === "on",
    pt: num(fd.get("pt")), tds: num(fd.get("tds")), pan: t(fd.get("pan"), 10)?.toUpperCase() || null, uan: t(fd.get("uan"), 20), esic_no: t(fd.get("esic_no"), 20),
    bank_name: t(fd.get("bank_name")), bank_account: t(fd.get("bank_account"), 30)?.replace(/\s/g, "") || null, ifsc: t(fd.get("ifsc"), 11)?.toUpperCase() || null,
    updated_at: new Date().toISOString(),
  };
  if (row.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(row.ifsc)) return { error: "IFSC looks wrong (like SBIN0001234)." };
  if (row.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(row.pan)) return { error: "PAN looks wrong (like ABCDE1234F)." };
  const id = String(fd.get("id") || "");
  const { error } = id ? await supabase.from("staff").update(row).eq("id", id).eq("company_id", company.id)
    : await supabase.from("staff").insert({ ...row, tenant_id: tenant.id, company_id: company.id });
  if (error) return { error: error.message };
  revalidatePath("/app/staff");
  redirect("/app/staff");
}

// work out the month's pay sheet from the days / advances / bonus typed, and keep it as a draft
export async function savePayroll(prev, fd) {
  const { supabase, tenant, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin runs payroll." };
  const month = String(fd.get("month") || "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick a month." };
  const { data: run } = await supabase.from("payroll_runs").select("status").eq("company_id", company.id).eq("month", month).maybeSingle();
  if (run?.status === "final") return { error: "This month is final and cannot be changed." };
  const { data: staff } = await supabase.from("staff").select("*").eq("company_id", company.id);
  const lines = activeIn(staff || [], month).map((s) => payLine(s, { days: fd.get(`days_${s.id}`), advance: fd.get(`adv_${s.id}`), bonus: fd.get(`bonus_${s.id}`) }, month));
  const { error } = await supabase.from("payroll_runs").upsert({ tenant_id: tenant.id, company_id: company.id, month, lines, totals: runTotals(lines), updated_at: new Date().toISOString() }, { onConflict: "company_id,month" });
  if (error) return { error: error.message };
  revalidatePath("/app/staff");
  return { message: "Pay sheet worked out and saved as a draft." };
}

export async function finalisePayroll(fd) {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) return;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("payroll_runs").update({ status: "final", finalised_at: new Date().toISOString(), finalised_by: user.id }).eq("company_id", company.id).eq("month", String(fd.get("month"))).eq("status", "draft");
  revalidatePath("/app/staff");
}
