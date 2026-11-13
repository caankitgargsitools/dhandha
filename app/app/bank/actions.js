"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { parseCsv } from "@/lib/leads";
import { readXlsx } from "@/lib/xlsx";
import { parseStatement } from "@/lib/bankRec";

const CAN = ["admin", "manager"];

export async function uploadStatement(prev, fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Only admins and managers see the bank." };
  const file = fd.get("file");
  if (!file || typeof file === "string" || !file.size) return { error: "Choose the statement file." };
  if (file.size > 5 * 1024 * 1024) return { error: "Files up to 5 MB — download a shorter period." };
  let rows;
  try {
    rows = /\.xlsx$/i.test(file.name) ? readXlsx(Buffer.from(await file.arrayBuffer()), { maxRows: 20000 }) : /\.(csv|txt)$/i.test(file.name) ? parseCsv(await file.text()) : null;
  } catch (e) { return { error: `Could not read the file: ${e.message}` }; }
  if (!rows) return { error: "Upload the statement as CSV or Excel (.xlsx). For an old .xls, open it and save as .xlsx." };
  const parsed = parseStatement(rows);
  if (parsed.error) return { error: parsed.error };
  if (!parsed.lines.length) return { error: "No transactions found in the file." };
  const account = String(fd.get("account") || "Main account").trim().slice(0, 60) || "Main account";
  const batch = `${new Date().toISOString().slice(0, 16)} ${file.name}`.slice(0, 120);
  const rowsIn = parsed.lines.map((l) => ({ ...l, tenant_id: tenant.id, company_id: company.id, account, batch }));
  const { data, error } = await supabase.from("bank_lines").upsert(rowsIn, { onConflict: "company_id,hash", ignoreDuplicates: true }).select("id");
  if (error) return { error: error.message };
  revalidatePath("/app/bank");
  const added = data?.length || 0;
  return { message: `${added} new line${added === 1 ? "" : "s"} added${parsed.lines.length - added ? `; ${parsed.lines.length - added} were already here` : ""}.` };
}

// confirm a suggested (or chosen) match: an invoice gets the payment, a deposit is marked refunded, an EMD paid is linked
export async function confirmMatch(fd) {
  const { supabase, company, role } = await getContext();
  if (!CAN.includes(role)) return;
  const id = String(fd.get("line")), kind = fd.get("kind"), target = String(fd.get("target") || "");
  const { data: l } = await supabase.from("bank_lines").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!l || l.status === "matched") return;
  const ref = [l.ref, l.narration].filter(Boolean).join(" · ").slice(0, 120);
  if (kind === "invoice") {
    const { error } = await supabase.rpc("invoice_payment_add", { p_invoice: target, p_amount: Number(l.credit), p_paid_on: l.txn_date, p_mode: "bank", p_ref: ref });
    if (error) return;
  } else if (kind === "refund") {
    const { error } = await supabase.rpc("deposit_save", { p_company: company.id, p: { id: target, status: "refunded", note: `Refund in bank on ${l.txn_date}` } });
    if (error) return;
  } else if (kind === "deposit") {
    await supabase.rpc("deposit_save", { p_company: company.id, p: { id: target, paid_on: l.txn_date, reference: l.ref || null } });
  } else return;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("bank_lines").update({ status: "matched", matched_kind: kind, matched_id: target, matched_by: user.id, matched_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/bank");
}

// "other": an expense / transfer explained with a note; "ignore"; "undo" puts it back (a recorded invoice payment stays)
export async function setLine(fd) {
  const { supabase, company, role } = await getContext();
  if (!CAN.includes(role)) return;
  const what = fd.get("what"), note = String(fd.get("note") || "").trim().slice(0, 200) || null;
  const { data: { user } } = await supabase.auth.getUser();
  const patch = what === "other" ? { status: "matched", matched_kind: "other", note, matched_by: user.id, matched_at: new Date().toISOString() }
    : what === "ignore" ? { status: "ignored", note } : what === "undo" ? { status: "unmatched", matched_kind: null, matched_id: null } : null;
  if (!patch) return;
  await supabase.from("bank_lines").update(patch).eq("id", String(fd.get("line"))).eq("company_id", company.id);
  revalidatePath("/app/bank");
}
