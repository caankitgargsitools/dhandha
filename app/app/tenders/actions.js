"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { SKIP_REASONS } from "@/lib/skipReasons";

// the stages the Tenders list shows (lib/tenderFilters.js STAGES); submitted / won / lost are set by hand after filing
const ALLOWED = ["new", "shortlisted", "preparing", "submitted", "won", "lost", "skipped"];

export async function setTenderStatus(formData) {
  const { supabase, company, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return { error: "Viewers cannot change a tender's stage." };
  const status = String(formData.get("status"));
  if (!ALLOWED.includes(status)) return { error: "Unknown stage." };
  const id = String(formData.get("id"));
  // why it was dropped (brief §3.7): kept on the match; "not our work" also teaches the AI check (as "Not my work")
  const reason = status === "skipped" ? String(formData.get("reason") || "") : "";
  const upd = { status, ...(status === "skipped" ? { skip_reason: SKIP_REASONS.some(([k]) => k === reason) ? reason : null } : {}) };
  const { error } = await supabase.from("tender_matches").update(upd).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message };
  if (reason === "not_our_work") await supabase.rpc("set_ai_fit", { p_match: id, p_fit: "no" });
  revalidatePath("/app/tenders");
  revalidatePath(`/app/tenders/${id}`);
  revalidatePath("/app");
}
