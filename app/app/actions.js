"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readVaultDocument } from "@/lib/vaultRead";
import { getContext, COMPANY_COOKIE } from "@/lib/session";

const s = (v) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};
// viewers (and disabled members) can look but not change the Vault
const VIEW_ONLY = { error: "You have view-only access. Ask your workspace admin to change this." };
const viewOnly = (role) => role === "viewer" || role === "disabled";
const n = (v) => {
  const t = s(v);
  if (t === null) return null;
  const x = Number(t.replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
};

export async function switchCompany(formData) {
  const store = await cookies();
  store.set(COMPANY_COOKIE, String(formData.get("company_id")), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/app", "layout");
}

export async function addCompany(prev, formData) {
  const { supabase, tenant } = await getContext();
  const name = s(formData.get("name"));
  if (!name) return { error: "Enter the company name." };
  const { data, error } = await supabase.rpc("add_company", { p_tenant: tenant.id, p_company_name: name });
  if (error) return { error: error.message };
  const store = await cookies();
  store.set(COMPANY_COOKIE, data, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app/vault/profile");
}

const PROFILE_FIELDS = ["legal_name", "trade_name", "constitution", "pan", "gstin", "cin", "udyam_no", "msme_category",
  "incorporation_date", "registered_address", "city", "state", "pincode", "email", "phone", "website",
  "signatory_name", "signatory_designation", "signatory_mobile", "bank_name", "bank_account", "bank_ifsc"];
const UPPER = new Set(["pan", "gstin", "cin", "udyam_no", "bank_ifsc"]);

export async function saveProfile(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const row = {};
  for (const f of PROFILE_FIELDS) {
    let v = s(formData.get(f));
    if (v && UPPER.has(f)) v = v.toUpperCase();
    row[f] = v;
  }
  if (!row.legal_name) return { error: "Legal name is required." };
  if (row.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(row.pan)) return { error: "PAN should look like ABCDE1234F." };
  if (row.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(row.gstin)) return { error: "GSTIN should be 15 characters, e.g. 07ABCDE1234F1Z5." };
  if (row.gstin && row.pan && row.gstin.slice(2, 12) !== row.pan) return { error: "GSTIN does not contain this PAN — please check both." };
  if (row.pincode && !/^[1-9][0-9]{5}$/.test(row.pincode)) return { error: "Pincode should be 6 digits." };
  if (row.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(row.bank_ifsc)) return { error: "IFSC should look like HDFC0001234." };
  const { error } = await supabase.from("companies").update(row).eq("id", company.id);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { message: "Saved." };
}

export async function saveFact(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const key = s(formData.get("key"));
  const value = s(formData.get("value"));
  if (!key || !value) return { error: "Both the fact and its value are needed." };
  const { error } = await supabase.from("company_facts").upsert(
    {
      tenant_id: tenant.id,
      company_id: company.id,
      key: key.toLowerCase().replace(/\s+/g, "_"),
      period: s(formData.get("period")) || "",
      value,
      unit: s(formData.get("unit")),
      valid_until: s(formData.get("valid_until")),
      source: "user",
    },
    { onConflict: "company_id,key,period" }
  );
  if (error) return { error: error.message };
  revalidatePath("/app/vault/facts");
  return { message: "Saved." };
}

export async function deleteRow(prev, formData) {
  const { supabase, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const table = String(formData.get("table"));
  const allowed = { company_facts: "/app/vault/facts", documents: "/app/vault/documents", experience_items: "/app/vault/experience", people: "/app/vault/people" };
  if (!allowed[table]) return { error: "This cannot be deleted here." };
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("id", String(formData.get("id")));
  if (error) return { error: error.message };
  if (!count) return { error: "Nothing was deleted: it is already gone, or your role cannot delete it." };
  revalidatePath(allowed[table]);
  return {};
}

// Letterhead header / footer heights, changed without uploading the file again.
export async function saveBrandMargins({ kind, meta }) {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only an admin can change brand assets." };
  const top = Number(meta?.margin_top_mm), bottom = Number(meta?.margin_bottom_mm);
  if (!(top >= 0 && top <= 120 && bottom >= 0 && bottom <= 80)) return { error: "Header 0–120 mm, footer 0–80 mm." };
  const { data: cur } = await supabase.from("brand_assets").select("id, meta").eq("company_id", company.id).eq("kind", kind).maybeSingle();
  if (!cur) return { error: "Upload the letterhead first." };
  const { error } = await supabase.from("brand_assets").update({ meta: { ...(cur.meta || {}), margin_top_mm: top, margin_bottom_mm: bottom } }).eq("id", cur.id);
  if (error) return { error: error.message };
  revalidatePath("/app/brand");
  return { ok: true };
}

export async function addDocument(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const type_code = s(formData.get("type_code"));
  if (!type_code) return { error: "Choose the document type." };
  // an uploaded file (DriveUpload fills drive_url + drive_file_id) wins over a pasted link
  const drive_url = s(formData.get("drive_url")) || s(formData.get("drive_link"));
  if (drive_url && !/^https:\/\/(drive|docs)\.google\.com\//.test(drive_url)) return { error: "Drive link should start with https://drive.google.com/ or https://docs.google.com/" };
  const uploadedId = s(formData.get("drive_file_id"));
  const idMatch = uploadedId ? [null, uploadedId] : drive_url?.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || drive_url?.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  // a file uploaded straight into Dhandha (VaultUpload) sits under this workspace's own folder
  const storage_path = s(formData.get("storage_path"));
  if (storage_path && !storage_path.startsWith(`${tenant.id}/${company.id}/`)) return { error: "That upload is not in this company's folder." };
  const { data: row, error } = await supabase.from("documents").insert({
    tenant_id: tenant.id,
    company_id: company.id,
    type_code,
    title: s(formData.get("title")),
    number: s(formData.get("number")),
    period: s(formData.get("period")),
    issued_on: s(formData.get("issued_on")),
    valid_until: s(formData.get("valid_until")),
    drive_url,
    drive_file_id: idMatch ? idMatch[1] : null,
    storage_path,
    file_name: s(formData.get("file_name")),
    mime: s(formData.get("mime")),
  }).select("id").single();
  if (error) return { error: error.message };
  // read it at once: what the document says goes into the masters
  const ctx = await getContext();
  const r = row.id && (storage_path || idMatch) ? await readVaultDocument(ctx, row.id) : null;
  revalidatePath("/app/vault", "layout");
  revalidatePath("/app");
  return { message: `Document added.${r?.message ? ` ${r.message}` : r?.error ? ` It could not be read: ${r.error}` : ""}` };
}

// Read a Vault document again (after a top-up, or a better copy).
export async function readDocumentAgain(docId) {
  const ctx = await getContext();
  if (viewOnly(ctx.role)) return VIEW_ONLY;
  const r = await readVaultDocument(ctx, String(docId));
  revalidatePath("/app/vault", "layout");
  return r;
}

// Take the document's value where it differs from the Vault (the person chose it).
export async function useDocumentValue(docId, idx) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const { data: doc } = await supabase.from("documents").select("id, extracted").eq("id", String(docId)).eq("company_id", company.id).maybeSingle();
  const c = doc?.extracted?.conflicts?.[Number(idx)];
  if (!c) return { error: "Nothing to change." };
  const COMPANY = ["legal_name", "trade_name", "constitution", "pan", "gstin", "cin", "udyam_no", "msme_category", "incorporation_date", "registered_address", "city", "state", "pincode"];
  let error;
  if (c.kind === "company" && COMPANY.includes(c.field)) ({ error } = await supabase.from("companies").update({ [c.field]: c.doc }).eq("id", company.id));
  else if (c.kind === "fact" && /^(fin|people)\./.test(c.field)) ({ error } = await supabase.from("company_facts").upsert({ tenant_id: tenant.id, company_id: company.id, key: c.field, period: c.period || "", value: String(c.doc), unit: c.field.startsWith("fin.") ? "INR" : "persons", source: "document" }, { onConflict: "company_id,key,period" }));
  else return { error: "Nothing to change." };
  if (error) return { error: error.message };
  const conflicts = doc.extracted.conflicts.map((x, i) => (i === Number(idx) ? { ...x, settled: "document" } : x));
  await supabase.from("documents").update({ extracted: { ...doc.extracted, conflicts } }).eq("id", doc.id);
  await supabase.rpc("rescore_company", { p_company: company.id });
  revalidatePath("/app/vault", "layout");
  return { ok: true };
}

export async function addExperience(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const client = s(formData.get("client"));
  const work_name = s(formData.get("work_name"));
  if (!client || !work_name) return { error: "Client and work name are required." };
  const { error } = await supabase.from("experience_items").insert({
    tenant_id: tenant.id, company_id: company.id, client, work_name,
    category: s(formData.get("category")),
    value_inr: n(formData.get("value_inr")),
    start_date: s(formData.get("start_date")),
    end_date: s(formData.get("end_date")),
    status: formData.get("status") === "ongoing" ? "ongoing" : "completed",
  });
  if (error) return { error: error.message };
  revalidatePath("/app/vault/experience");
  return { message: "Added." };
}

export async function addPerson(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const name = s(formData.get("name"));
  if (!name) return { error: "Name is required." };
  const { error } = await supabase.from("people").insert({
    tenant_id: tenant.id, company_id: company.id, name,
    designation: s(formData.get("designation")),
    qualification: s(formData.get("qualification")),
    years_experience: n(formData.get("years_experience")),
    membership_no: s(formData.get("membership_no")),
    pan: s(formData.get("pan"))?.toUpperCase() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/vault/people");
  return { message: "Added." };
}

// Edit one Vault row in place: only the selected company's row with this id, never a viewer's.
async function updateVaultRow(table, path, formData, fields) {
  const { supabase, tenant, company, role } = await getContext();
  if (viewOnly(role)) return VIEW_ONLY;
  const id = s(formData.get("id"));
  if (!id) return { error: "Which row? Open the page again and retry." };
  const { error, count } = await supabase.from(table).update(fields, { count: "exact" })
    .eq("id", id).eq("company_id", company.id).eq("tenant_id", tenant.id);
  if (error) return { error: /duplicate key/i.test(error.message) ? "That already exists — edit the existing row instead." : error.message };
  if (!count) return { error: "Nothing was changed: it is gone, or your role cannot change it." };
  revalidatePath(path);
  return { message: "Saved." };
}

export async function updateFact(prev, formData) {
  const key = s(formData.get("key"));
  const value = s(formData.get("value"));
  if (!key || !value) return { error: "Both the fact and its value are needed." };
  return updateVaultRow("company_facts", "/app/vault/facts", formData, {
    key: key.toLowerCase().replace(/\s+/g, "_"),
    period: s(formData.get("period")) || "",
    value,
    unit: s(formData.get("unit")),
    valid_until: s(formData.get("valid_until")),
    source: "user",
  });
}

export async function updateExperience(prev, formData) {
  const client = s(formData.get("client"));
  const work_name = s(formData.get("work_name"));
  if (!client || !work_name) return { error: "Client and work name are required." };
  return updateVaultRow("experience_items", "/app/vault/experience", formData, {
    client, work_name,
    category: s(formData.get("category")),
    value_inr: n(formData.get("value_inr")),
    start_date: s(formData.get("start_date")),
    end_date: s(formData.get("end_date")),
    status: formData.get("status") === "ongoing" ? "ongoing" : "completed",
  });
}

export async function updatePerson(prev, formData) {
  const name = s(formData.get("name"));
  if (!name) return { error: "Name is required." };
  return updateVaultRow("people", "/app/vault/people", formData, {
    name,
    designation: s(formData.get("designation")),
    qualification: s(formData.get("qualification")),
    years_experience: n(formData.get("years_experience")),
    membership_no: s(formData.get("membership_no")),
    pan: s(formData.get("pan"))?.toUpperCase() || null,
  });
}

export async function recordBrandAsset({ kind, path, meta }) {
  const { supabase, tenant, company, isAdmin, has2fa } = await getContext();
  if (!isAdmin) return { error: "Only an admin can change brand assets." };
  if ((kind === "signature" || kind === "seal") && !has2fa) return { error: "Turn on two-factor login before storing a signature or seal." };
  if (!String(path).startsWith(`${tenant.id}/${company.id}/`)) return { error: "Invalid file path." };
  const { data: old } = await supabase.from("brand_assets").select("storage_path").eq("company_id", company.id).eq("kind", kind).maybeSingle();
  const { error } = await supabase.from("brand_assets").upsert(
    { tenant_id: tenant.id, company_id: company.id, kind, storage_path: path, meta: meta || {} },
    { onConflict: "company_id,kind" }
  );
  if (error) return { error: error.message };
  if (old?.storage_path && old.storage_path !== path) await supabase.storage.from("brand").remove([old.storage_path]);
  revalidatePath("/app/brand");
  return { ok: true };
}

export async function disconnectDrive() {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return;
  await supabase.rpc("disconnect_drive", { p_tenant: tenant.id });
  revalidatePath("/app/settings/drive");
}

export async function disconnectMetaPage(formData) {
  const { supabase, isAdmin } = await getContext();
  if (!isAdmin) return;
  await supabase.rpc("disconnect_meta_page", { p_page: String(formData.get("page_id")) });
  revalidatePath("/app/settings/facebook");
}
