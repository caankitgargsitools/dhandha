"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const done = (error, ok) => { revalidatePath("/app/tenders/partners"); return error ? { error: error.message } : { ok }; };

export async function saveProfile(_prev, formData) {
  const { supabase, company } = await getContext();
  const states = String(formData.get("states") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 37);
  const { error } = await supabase.rpc("partner_profile_save", { p_company: company.id, p: {
    open: formData.get("open") === "on", consortium: formData.get("consortium") === "on", sub_take: formData.get("sub_take") === "on", sub_give: formData.get("sub_give") === "on",
    states, blurb: String(formData.get("blurb") || "").slice(0, 500) } });
  return done(error, "Saved.");
}

export async function sendRequest(_prev, formData) {
  const { supabase, company } = await getContext();
  const { error } = await supabase.rpc("partner_request_send", {
    p_from: company.id, p_to: String(formData.get("to") || "") || null, p_kind: String(formData.get("kind")),
    p_tender: String(formData.get("tender") || "") || null, p_subwork: String(formData.get("subwork") || "") || null, p_message: String(formData.get("message") || "").slice(0, 1000) });
  return done(error, "Sent — they get a phone alert. Their contact details show here once they accept.");
}

export async function answerRequest(formData) {
  const { supabase } = await getContext();
  await supabase.rpc("partner_request_answer", { p_id: String(formData.get("id")), p_accept: formData.get("accept") === "1" });
  revalidatePath("/app/tenders/partners");
}

export async function postSubwork(_prev, formData) {
  const { supabase, company } = await getContext();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 5) return { error: "Say in a few words what work you want to give out." };
  const { error } = await supabase.rpc("subwork_save", { p_company: company.id, p: {
    title, details: String(formData.get("details") || ""), industry_pack: String(formData.get("industry_pack") || ""), state: String(formData.get("state") || ""),
    city: String(formData.get("city") || ""), value_inr: String(formData.get("value_inr") || "").replace(/[^0-9.]/g, ""), closes_on: String(formData.get("closes_on") || "") } });
  return done(error, "Posted — open partner firms in that work and state can now see it.");
}

export async function closeSubwork(formData) {
  const { supabase, company } = await getContext();
  await supabase.rpc("subwork_save", { p_company: company.id, p: { id: String(formData.get("id")), status: "closed" } });
  revalidatePath("/app/tenders/partners");
}
