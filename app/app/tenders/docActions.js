"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// Tender assistant → crawler: fetch this tender's documents from its portal.
export async function fetchDocs({ matchId }) {
  const { supabase, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot fetch documents." };
  const { data: jobId, error } = await supabase.rpc("request_tender_docs", { p_match: matchId });
  if (error) return { error: error.message };
  // the always-on fetcher (GitHub Actions "tender docs") claims it within seconds
  return { jobId };
}

export async function answerDocCaptcha({ jobId, answer }) {
  const { supabase, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot answer." };
  const { error } = await supabase.rpc("answer_doc_captcha", { p_job: jobId, p_answer: String(answer || "") });
  return error ? { error: error.message } : { ok: true };
}

export async function cancelDocJob({ jobId }) {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("mark_doc_job", { p_job: jobId, p_status: "cancelled" });
  return error ? { error: error.message } : { ok: true };
}

const TYPES = { pdf: "application/pdf", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
// PostgREST returns bytea as "\x<hex>"
const fromBytea = (v) => Buffer.from(String(v).replace(/^\\x/, ""), "hex");

// The crawler handed the files over in chunks: put them in Storage (as this user) and list them on the tender.
export async function collectDocs({ jobId }) {
  const { supabase, user, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot do this." };
  const { data: job } = await supabase.from("tender_doc_jobs").select("*").eq("id", jobId).single();
  if (!job) return { error: "Job not found." };
  if (job.status === "collected") return { ok: true, count: job.files.length };
  if (job.status !== "fetched") return { error: "The documents are not ready yet." };
  const { data: existing } = await supabase.from("tender_files").select("file_name").eq("tender_id", job.tender_id);
  const have = new Set((existing || []).map((f) => f.file_name));
  let added = 0;
  for (const f of job.files) {
    if (have.has(f.name)) continue;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!TYPES[ext]) continue;
    const { data: chunks, error } = await supabase.from("tender_doc_chunks").select("seq, data").eq("job_id", jobId).eq("file_no", f.no).order("seq");
    if (error || !chunks?.length) continue;
    const bytes = Buffer.concat(chunks.map((c) => fromBytea(c.data)));
    const path = `${job.tender_id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: up } = await supabase.storage.from("tender-docs").upload(path, bytes, { contentType: TYPES[ext] });
    if (up) return { error: `Could not store ${f.name}: ${up.message}` };
    await supabase.from("tender_files").insert({ tender_id: job.tender_id, storage_path: path, file_name: f.name.slice(0, 200), size_bytes: bytes.length, uploaded_by: user.id });
    added++;
  }
  await supabase.rpc("mark_doc_job", { p_job: jobId, p_status: "collected" });
  revalidatePath(`/app/tenders/${job.match_id}`);
  return { ok: true, count: added };
}

// "Looks good — start preparing": the brief is accepted and the tender moves to Preparing.
export async function confirmBrief({ matchId, go }) {
  const { supabase, role, company } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot do this." };
  const { error } = await supabase.from("tender_matches").update({ status: go ? "preparing" : "skipped" }).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath("/app/tenders");
  revalidatePath(`/app/tenders/${matchId}`);
  return { ok: true };
}
