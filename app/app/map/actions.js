"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// "Pause all automation" / "Resume": autopilot, AI check, playbooks, win-back and review requests (SQL automation_pause
// keeps what was on and switches back exactly that)
export async function automationPause(formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return;
  await supabase.rpc("automation_pause", { p_company: company.id, p_on: formData.get("on") === "1" });
  revalidatePath("/app/map");
}
