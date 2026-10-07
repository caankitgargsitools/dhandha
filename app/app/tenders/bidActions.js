"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { buildBidPack } from "@/lib/bidpack";
import { keywordsFor, SERVICE_INDEX } from "@/lib/taxonomy";

async function download(supabase, path) {
  const { data, error } = await supabase.storage.from("brand").download(path);
  if (error) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function generateBidPack(prev, formData) {
  const { supabase, tenant, company, role, isAdmin, user } = await getContext();
  const matchId = String(formData.get("match_id"));
  const kind = formData.get("kind") === "final" ? "final" : "draft";
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can make bid packs." };

  const { data: match } = await supabase.from("tender_matches").select("id, tender_id, company_id, filled_formats, tenders(*)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!match) return { error: "Tender not found for this company." };

  if (kind === "final") {
    if (!isAdmin) return { error: "Only an admin (the signatory) can approve use of the signature." };
    const code = String(formData.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };
    const { data: f } = await supabase.auth.mfa.listFactors();
    const factor = f?.totp?.find((x) => x.status === "verified");
    if (!factor) return { error: "Turn on two-factor login in Security first." };
    const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (ve) return { error: "That code did not work. Use the latest code from your authenticator app." };
  }

  const [{ data: c }, { data: facts }, { data: works }, { data: people }, { data: docs }, { data: docTypes }, { data: brand }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("company_facts").select("key, period, value, unit").eq("company_id", company.id),
    supabase.from("experience_items").select("*").eq("company_id", company.id),
    supabase.from("people").select("*").eq("company_id", company.id),
    supabase.from("documents").select("type_code, number, period, valid_until, title").eq("company_id", company.id).eq("status", "active"),
    supabase.from("document_types").select("code, name"),
    supabase.from("brand_assets").select("kind, storage_path, meta").eq("company_id", company.id),
  ]);
  const asset = (k) => (brand || []).find((b) => b.kind === k);
  const lh = asset("letterhead");
  const ctx = { formats: match.filled_formats || [], tender: match.tenders, company: c, facts: facts || [], works: works || [], people: people || [], docs: docs || [], docTypes: docTypes || [], draft: kind === "draft" };
  if (lh) {
    ctx.letterheadBytes = await download(supabase, lh.storage_path);
    ctx.letterheadType = lh.storage_path.endsWith(".pdf") ? "pdf" : lh.storage_path.endsWith(".png") ? "png" : "jpg";
    ctx.margins = lh.meta;
  }
  if (kind === "final") {
    const sig = asset("signature");
    if (!sig) return { error: "Upload the signatory's signature in Letterhead & signature first." };
    ctx.signatureBytes = await download(supabase, sig.storage_path);
    const seal = asset("seal");
    if (seal) ctx.sealBytes = await download(supabase, seal.storage_path);
    if (!ctx.signatureBytes) return { error: "Could not read the stored signature." };
  }

  let pack;
  try { pack = await buildBidPack(ctx); } catch (e) { return { error: `Could not build the PDF: ${e.message}` }; }

  if (kind === "final") {
    const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "bid_pack", p_qty: 1, p_ref: match.tenders.tender_ref });
    if (se) return { error: se.message.includes("insufficient") ? "Not enough credits — a signed bid pack costs 299 credits." : se.message };
  }
  const path = `${tenant.id}/${company.id}/${match.id}/${kind}-${Date.now()}.pdf`;
  const { error: ue } = await supabase.storage.from("bids").upload(path, pack.bytes, { contentType: "application/pdf" });
  if (ue) return { error: `Could not save the PDF: ${ue.message}` };
  await supabase.from("bid_packs").insert({ tenant_id: tenant.id, company_id: company.id, match_id: match.id, tender_id: match.tender_id, kind, storage_path: path, annexures: pack.annexures, pages: pack.pages, created_by: user.id });
  if (kind === "final") {
    await supabase.rpc("log_signature_use", { p_company: company.id, p_label: `Bid pack: ${pack.annexures.length} documents`, p_context: `${match.tenders.portal} ${match.tenders.tender_ref}`, p_otp_ref: `TOTP ${new Date().toISOString()}` });
    await supabase.from("tender_matches").update({ status: "preparing" }).eq("id", match.id);
  }
  const { data: signed } = await supabase.storage.from("bids").createSignedUrl(path, 3600);
  revalidatePath(`/app/tenders/${match.id}`);
  return { message: kind === "final" ? `Signed bid pack ready: ${pack.pages} pages, 299 credits used.` : `Draft ready: ${pack.pages} pages (unsigned, marked DRAFT).`, url: signed?.signedUrl };
}

export async function savePreferences(prev, formData) {
  const { supabase, tenant, company } = await getContext();
  const list = (k) => String(formData.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const num = (k) => { const v = String(formData.get(k) || "").replace(/,/g, "").trim(); return v ? Number(v) * (formData.get(`${k}_unit`) === "cr" ? 1e7 : 1e5) : null; };
  const services = formData.getAll("services").map(String).filter((id) => SERVICE_INDEX[id]);
  const custom = list("keywords");
  const row = {
    company_id: company.id, tenant_id: tenant.id,
    services, custom_keywords: custom,
    // matching is by the chosen services' own words, so "roads" does not pull in every construction tender
    packs: [],
    allowed_packs: [...new Set(services.map((id) => SERVICE_INDEX[id].pack || "any"))],
    keywords: [...new Set([...keywordsFor(services), ...custom])], exclude_keywords: list("exclude_keywords"), states: formData.getAll("states").map(String),
    min_value: num("min_value"), max_value: num("max_value"), max_emd: num("max_emd"),
    min_days_left: Number(formData.get("min_days_left") || 5), updated_at: new Date().toISOString(),
  };
  if (!row.keywords.length) return { error: "Choose at least one service, or type a few words to match." };
  const { error } = await supabase.from("tender_preferences").upsert(row, { onConflict: "company_id" });
  if (error) return { error: error.message };
  const { data: n, error: re } = await supabase.rpc("rescore_company", { p_company: company.id });
  if (re) return { error: re.message };
  revalidatePath("/app/tenders");
  return { message: `Saved. ${n} open tenders re-scored for ${company.legal_name}.` };
}

export async function rescore() {
  const { supabase, company } = await getContext();
  await supabase.rpc("rescore_company", { p_company: company.id });
  revalidatePath("/app/tenders");
  revalidatePath("/app");
}
