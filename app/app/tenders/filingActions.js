"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { emdOnFiling } from "@/lib/filing";

const canFile = (role) => ["admin", "manager", "bid_preparer"].includes(role);

// tick / untick one item of the upload kit as it is uploaded on the portal
export async function tickUpload({ matchId, key, on }) {
  const { supabase, company, role } = await getContext();
  if (!canFile(role)) return { error: "Only admins, managers and bid preparers can do this." };
  if (!/^(pack|doc:[A-Z0-9-]{2,30})$/.test(String(key))) return { error: "Unknown item." };
  const { data: m } = await supabase.from("tender_matches").select("upload_ticks").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  const ticks = { ...(m.upload_ticks || {}) };
  if (on) ticks[key] = new Date().toISOString(); else delete ticks[key];
  const { error } = await supabase.from("tender_matches").update({ upload_ticks: ticks }).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath(`/app/tenders/${matchId}`);
  return { ok: true };
}

// "We have filed it": the portal's bid id / receipt number → status submitted; the EMD goes on the deposit register
export async function markFiled(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (!canFile(role)) return { error: "Only admins, managers and bid preparers can do this." };
  const matchId = String(formData.get("match_id") || "");
  const ref = String(formData.get("submission_ref") || "").trim().slice(0, 120);
  if (!ref) return { error: "Type the bid id or receipt number the portal gave you — it proves the bid was filed." };
  const { data: m } = await supabase.from("tender_matches").select("id, status, tenders(emd_inr, mse_emd_exempt)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  const { error } = await supabase.from("tender_matches").update({ status: "submitted", submitted_at: new Date().toISOString(), submission_ref: ref }).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  let note = "";
  const { data: c } = await supabase.from("companies").select("msme_category, udyam_no").eq("id", company.id).single();
  const { data: dep } = await supabase.from("bid_deposits").select("id").eq("match_id", matchId).eq("kind", "emd").limit(1);
  const emd = emdOnFiling({ emd: m.tenders?.emd_inr, msme: ["micro", "small"].includes(c?.msme_category) && !!c?.udyam_no, mseExempt: !!m.tenders?.mse_emd_exempt,
    mode: String(formData.get("emd_mode") || "online"), reference: String(formData.get("emd_ref") || "").trim().slice(0, 120) || null });
  if (emd && !dep?.length) {
    const { error: de } = await supabase.rpc("deposit_save", { p_company: company.id, p: { ...emd, match_id: matchId, paid_on: new Date().toISOString().slice(0, 10) } });
    note = de ? ` (The EMD could not be added to the deposit register: ${de.message})` : emd.status === "exempt" ? " EMD exemption recorded." : " EMD added to EMD & deposits — its refund is tracked.";
  }
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath("/app/tenders");
  revalidatePath("/app/tenders/closing");
  return { message: `Marked as filed (${ref}).${note} When the result is out, Dhandha fills it in from the portal's results where it can.` };
}
