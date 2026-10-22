"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";
import { readXlsx } from "@/lib/xlsx";
import { parseCsv } from "@/lib/leads";
import { rowsToRecords, buildFacets } from "@/lib/datasets";

const BASIS = ["public_business_info", "consent", "own_customers"];

// A file already uploaded to the private "datasets" bucket → a new dataset (draft) with its records.
export async function processDataset({ path, fileName, name, source_label, audience, lawful_basis, source_note, price, declared }) {
  const { supabase } = await getAdminContext();
  if (!declared) return { error: "Confirm the source and legal basis first." };
  if (!BASIS.includes(lawful_basis)) return { error: "Choose the legal basis." };
  if (audience === "consumer" && lawful_basis === "public_business_info") return { error: "Consumer data needs the people's consent (or must be your own customers). It cannot be sold as public business information." };
  if (String(name || "").trim().length < 2 || String(source_label || "").trim().length < 2) return { error: "Give the database a name and say where it came from." };
  const { data: file, error: de } = await supabase.storage.from("datasets").download(path);
  if (de) return { error: `Could not read the upload: ${de.message}` };
  const buf = Buffer.from(await file.arrayBuffer());
  let rows;
  try { rows = /\.xlsx$/i.test(fileName) ? readXlsx(buf, { maxRows: 100001 }) : parseCsv(buf.toString("utf8")); }
  catch (e) { return { error: `Could not read the file: ${e.message}. Old .xls files: save as .xlsx or CSV first.` }; }
  const parsed = rowsToRecords(rows, { maxRows: 100000 });
  if (parsed.error) return { error: parsed.error };
  const { facets, fields } = buildFacets(parsed.records, parsed.fields);
  const { data: setId, error: se } = await supabase.rpc("data_set_save", { p: { name: String(name).trim(), source_label: String(source_label).trim(), audience, lawful_basis, source_note: String(source_note || "").slice(0, 1000), price_credits: Number(price) || 1, fields, facets } });
  if (se) return { error: se.message };
  let added = 0;
  for (let i = 0; i < parsed.records.length; i += 1000) {
    const { data: n, error } = await supabase.rpc("data_ingest", { p_set: setId, p_rows: parsed.records.slice(i, i + 1000) });
    if (error) return { error: `Stopped after ${added} records: ${error.message}` };
    added += n;
  }
  revalidatePath("/admin/data");
  return { message: `${added.toLocaleString("en-IN")} records loaded as a draft (${parsed.mapped.join(", ")} recognised; ${Object.keys(facets).length} filters). Check it, then press Go live.${parsed.truncated ? " Only the first 100,000 rows were loaded; split bigger files." : ""}` };
}

export async function setDatasetStatus(formData) {
  const { supabase } = await getAdminContext();
  const status = String(formData.get("status"));
  if (!["live", "withdrawn", "draft"].includes(status)) return;
  await supabase.rpc("data_set_save", { p: { id: String(formData.get("id")), status, ...(formData.get("price") ? { price_credits: Number(formData.get("price")) } : {}) } });
  revalidatePath("/admin/data");
}

export async function suppress(prev, formData) {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("data_suppress", { p_email: String(formData.get("email") || ""), p_phone: String(formData.get("phone") || ""), p_reason: String(formData.get("reason") || "opt-out request") });
  if (error) return { error: error.message };
  revalidatePath("/admin/data");
  return { message: "Removed: this person will never be shown or sold." };
}
