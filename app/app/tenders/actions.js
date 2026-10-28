"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// the stages the Tenders list shows (lib/tenderFilters.js STAGES); submitted / won / lost are set by hand after filing
const ALLOWED = ["new", "shortlisted", "preparing", "submitted", "won", "lost", "skipped"];

export async function setTenderStatus(formData) {
  const { supabase, company, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return { error: "Viewers cannot change a tender's stage." };
  const status = String(formData.get("status"));
  if (!ALLOWED.includes(status)) return { error: "Unknown stage." };
  const id = String(formData.get("id"));
  const { error } = await supabase.from("tender_matches").update({ status }).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath("/app/tenders");
  revalidatePath(`/app/tenders/${id}`);
  revalidatePath("/app");
}
