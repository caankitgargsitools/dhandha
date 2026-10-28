"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// Answers from the tender assistant and the question cards. Each one is saved to the Vault (Facts),
// then every live tender is re-scored, so one "Yes" qualifies all tenders that asked the same thing.

const KEY = /^(presence|gst|cert|reg|age|cond)\.[a-z0-9_.]{2,110}$/;

async function rescoreAll(supabase, company, matchId) {
  await supabase.rpc("rescore_company", { p_company: company.id });
  revalidatePath("/app/tenders");
  if (matchId) { revalidatePath(`/app/tenders/${matchId}`); revalidatePath(`/app/tenders/${matchId}/assistant`); }
}

export async function answerQuestion({ key, value, label, matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot answer." };
  if (!KEY.test(String(key))) return { error: "Unknown question." };
  if (!["yes", "no"].includes(value)) return { error: "Answer Yes or No." };
  const { error } = await supabase.from("company_facts").upsert(
    { tenant_id: tenant.id, company_id: company.id, key, period: "", value, unit: label ? String(label).slice(0, 120) : null, source: "tender assistant" },
    { onConflict: "company_id,key,period" },
  );
  if (error) return { error: error.message };
  await rescoreAll(supabase, company, matchId);
  return { ok: true };
}

// Last three financial years' turnover, in rupees.
export async function saveTurnover({ values, matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot answer." };
  const rows = Object.entries(values || {})
    .filter(([fy, v]) => /^FY \d{4}-\d{2}$/.test(fy) && String(v).trim() !== "")
    .map(([fy, v]) => {
      const n = Number(String(v).replace(/[,₹\s]/g, ""));
      return Number.isFinite(n) && n >= 0 ? { tenant_id: tenant.id, company_id: company.id, key: "fin.turnover", period: fy, value: String(Math.round(n)), unit: "INR", source: "tender assistant" } : null;
    });
  if (!rows.length || rows.some((r) => !r)) return { error: "Enter each year's turnover as a number in rupees, e.g. 25000000." };
  const { error } = await supabase.from("company_facts").upsert(rows, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  await rescoreAll(supabase, company, matchId);
  return { ok: true };
}
