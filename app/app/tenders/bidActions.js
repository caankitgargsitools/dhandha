"use server";
import { pullFromGoogle } from "@/lib/outsideEdit";
import { revalidatePath } from "next/cache";
import { fillPlaceholders } from "@/lib/masters";
import { withLock } from "@/lib/locks";
import { getContext } from "@/lib/session";
import { buildBidPack } from "@/lib/bidpack";
import { mandatoryUnmet } from "@/lib/conditions";
import { keywordsFor, rulesFor, parseRule } from "@/lib/taxonomy";
import { loadCatalog } from "@/lib/catalog";

async function download(supabase, path) {
  const { data, error } = await supabase.storage.from("brand").download(path);
  if (error) return null;
  return new Uint8Array(await data.arrayBuffer());
}

async function generateBidPackLocked(prev, formData) {
  const { supabase, tenant, company, role, isAdmin, user } = await getContext();
  const matchId = String(formData.get("match_id"));
  const kind = formData.get("kind") === "final" ? "final" : "draft";
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can make bid packs." };

  const { data: match } = await supabase.from("tender_matches").select("id, tender_id, company_id, filled_formats, reasons, eligible, forced_at, quoted_price, price_note, cost_sheet, tenders(*)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!match) return { error: "Tender not found for this company." };
  // formats being filled in Google Docs / Sheets: take what is saved there now
  if ((match.filled_formats || []).some((f) => f.gdoc?.id)) {
    try {
      const r = await pullFromGoogle({ supabase, tenant, company, plan: match.filled_formats, tender: match.tenders });
      if (r.changed) { match.filled_formats = r.plan; await supabase.from("tender_matches").update({ filled_formats: r.plan }).eq("id", matchId); }
    } catch {}
  }
  // a mandatory condition that is not met: no bid file until the person says it is met or chooses to file anyway
  if (mandatoryUnmet(match.reasons).length && !match.forced_at) return { error: "A mandatory condition of this tender is not met. Open the tender assistant: confirm you meet it, or choose “File anyway”." };

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
  const [{ data: reads }, { data: jobs }] = await Promise.all([
    supabase.from("tender_reads").select("fields, risks, summary, formats").eq("tender_id", match.tender_id).order("created_at", { ascending: false }).limit(1),
    supabase.from("tender_doc_jobs").select("detail").eq("tender_id", match.tender_id).order("created_at", { ascending: false }).limit(1),
  ]);
  const ctx = { price: { quoted_price: match.quoted_price, price_note: match.price_note, cost_sheet: match.cost_sheet }, read: reads?.[0], detail: jobs?.[0]?.detail, reasons: match.reasons || [], unmet: mandatoryUnmet(match.reasons || []), formats: match.filled_formats || [], tender: match.tenders, company: c, facts: facts || [], works: works || [], people: people || [], docs: docs || [], docTypes: docTypes || [], draft: kind === "draft" };
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

  // a signed pack only when it is complete: no blank left in any format, the price set
  if (kind === "final") {
    const left = (match.filled_formats || []).filter((f) => !["price", "covering_letter"].includes(f.kind))
      .map((f) => ({ title: f.title, n: (String(f.edited_text || fillPlaceholders(f.filled_text || "", facts || [], { people: people || [], works: works || [], company: c, tender: match.tenders })).match(/\[TO BE FILLED:/gi) || []).length }))
      .filter((x) => x.n);
    if (left.length) return { error: `Not ready to sign: ${left.map((x) => `${x.title} (${x.n} blank${x.n === 1 ? "" : "s"})`).slice(0, 5).join(", ")}${left.length > 5 ? ` and ${left.length - 5} more` : ""}. Fill them in the assistant ("Your formats" → Open as a form), then sign.` };
  }
  let pack;
  try { pack = await buildBidPack(ctx); } catch (e) { return { error: `Could not build the PDF: ${e.message}` }; }

  // save first, then charge: a failed upload never costs credits; a failed charge removes the saved file
  const path = `${tenant.id}/${company.id}/${match.id}/${kind}-${Date.now()}.pdf`;
  const { error: ue } = await supabase.storage.from("bids").upload(path, pack.bytes, { contentType: "application/pdf" });
  if (ue) return { error: `Could not save the PDF: ${ue.message}` };
  if (kind === "final") {
    const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "bid_pack", p_qty: 1, p_ref: match.tenders.tender_ref });
    if (se) {
      await supabase.storage.from("bids").remove([path]).then(() => {}, () => {});
      return { error: se.message.includes("insufficient") ? "Not enough credits — a signed bid pack costs 299 credits." : se.message };
    }
  }
  await supabase.from("bid_packs").insert({ tenant_id: tenant.id, company_id: company.id, match_id: match.id, tender_id: match.tender_id, kind, storage_path: path, annexures: pack.annexures, pages: pack.pages, created_by: user.id });
  if (kind === "final") {
    await supabase.rpc("log_signature_use", { p_company: company.id, p_label: `Bid pack: ${pack.annexures.length} documents`, p_context: `${match.tenders.portal} ${match.tenders.tender_ref}`, p_otp_ref: `TOTP ${new Date().toISOString()}` });
    await supabase.from("tender_matches").update({ status: "preparing" }).eq("id", match.id).in("status", ["new", "shortlisted"]);
  }
  const { data: signed } = await supabase.storage.from("bids").createSignedUrl(path, 3600);
  revalidatePath(`/app/tenders/${match.id}`);
  return { message: kind === "final" ? `Signed bid pack ready: ${pack.pages} pages, 299 credits used.` : `Draft ready: ${pack.pages} pages (unsigned, marked DRAFT).`, url: signed?.signedUrl };
}

// viewers (and disabled members) only look; everyone else may change the tender list
const READ_ONLY = ["viewer", "disabled"];
const readOnly = (role) => (READ_ONLY.includes(role) ? { error: "Viewers cannot change this." } : null);

export async function savePreferences(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (readOnly(role)) return readOnly(role);
  const list = (k) => String(formData.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const num = (k) => { const v = String(formData.get(k) || "").replace(/,/g, "").trim(); return v ? Number(v) * (formData.get(`${k}_unit`) === "cr" ? 1e7 : 1e5) : null; };
  const { index } = await loadCatalog(supabase, tenant.id);
  const services = formData.getAll("services").map(String).filter((id) => index[id]);
  const custom = list("keywords");
  const { data: old } = await supabase.from("tender_preferences").select("muted").eq("company_id", company.id).maybeSingle();
  // the switched-off words come from the form when it shows them (removing one switches it back on)
  const mutedIn = formData.has("muted") ? list("muted").map((m) => m.toLowerCase()) : old?.muted || [];
  const muted = mutedIn.filter((m) => !custom.some((c) => parseRule(c).k.toLowerCase() === m));
  const row = {
    company_id: company.id, tenant_id: tenant.id,
    services, custom_keywords: custom,
    // matching is by the chosen services' own words, so "roads" does not pull in every construction tender
    packs: [],
    allowed_packs: [...new Set(services.map((id) => index[id].pack || "any"))],
    keywords: [...new Set([...keywordsFor(services, index), ...custom.map((c) => parseRule(c).k)])], rules: rulesFor(services, custom, muted, index), muted, exclude_keywords: list("exclude_keywords"), states: formData.getAll("states").map(String),
    min_value: num("min_value"), max_value: num("max_value"), max_emd: num("max_emd"),
    min_days_left: Number(formData.get("min_days_left") || 5), ai_check: formData.get("ai_check") === "on", updated_at: new Date().toISOString(),
  };
  if (!row.keywords.length) return { error: "Choose at least one service, or type a few words to match." };
  const { error } = await supabase.from("tender_preferences").upsert(row, { onConflict: "company_id" });
  if (error) return { error: error.message };
  const { data: n, error: re } = await supabase.rpc("rescore_company", { p_company: company.id });
  if (re) return { error: re.message };
  revalidatePath("/app/tenders");
  return { message: `Saved. ${n} open tenders re-scored for ${company.legal_name}.` };
}

// AI tender check: start a run now (it also runs every hour), and a person's word on one tender.
export async function aiCheckNow() {
  const { supabase, company, role } = await getContext();
  if (readOnly(role)) return readOnly(role);
  await supabase.rpc("ai_check_now", { p_company: company.id });
  revalidatePath("/app/tenders");
}
export async function setAiFit(formData) {
  const { supabase, role } = await getContext();
  if (readOnly(role)) return readOnly(role);
  await supabase.rpc("set_ai_fit", { p_match: String(formData.get("id")), p_fit: formData.get("fit") === "no" ? "no" : "yes" });
  revalidatePath("/app/tenders");
}

export async function rescore() {
  const { supabase, company, role } = await getContext();
  if (readOnly(role)) return readOnly(role);
  await supabase.rpc("rescore_company", { p_company: company.id });
  revalidatePath("/app/tenders");
  revalidatePath("/app");
}

// "Never match this word": the word stops counting for this company; its tenders are hidden on re-score.
export async function muteTenderWord(formData) {
  const { supabase, company, tenant, role } = await getContext();
  if (readOnly(role)) return readOnly(role);
  const word = String(formData.get("word") || "").trim().toLowerCase();
  if (!word) return;
  const { data: p } = await supabase.from("tender_preferences").select("services, custom_keywords, muted").eq("company_id", company.id).maybeSingle();
  if (!p) return;
  const { index } = await loadCatalog(supabase, tenant.id);
  const rules = rulesFor(p.services || [], p.custom_keywords || [], [...(p.muted || []), word], index);
  await supabase.rpc("mute_tender_word", { p_company: company.id, p_word: word, p_rules: rules });
  revalidatePath("/app/tenders");
}

export async function generateBidPack(prev, formData) {
  const { supabase, company } = await getContext();
  return withLock(supabase, { company: company.id, action: "bid_pack", ref: formData.get("match_id"), seconds: 180 }, () => generateBidPackLocked(prev, formData));
}
