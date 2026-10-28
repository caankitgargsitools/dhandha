import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Writer, clean, rs } from "./bidpack.js";

// A quotation on the company's letterhead (or a plain header). Not signed: "Authorised signatory" only — signatures
// go on documents only after the admin's code (bid packs).
export async function buildQuotePdf({ quote, company, letterheadBytes, letterheadType, margins }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(`Quotation ${quote.number}`));
  pdf.setAuthor(clean(company.legal_name));
  const fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const ctx = { company, draft: false };
  if (letterheadBytes) {
    if (letterheadType === "pdf") { const [e] = await pdf.embedPdf(letterheadBytes, [0]); ctx.letterhead = { embedded: e, marginTop: margins?.margin_top_mm, marginBottom: margins?.margin_bottom_mm }; }
    else { const img = letterheadType === "png" ? await pdf.embedPng(letterheadBytes) : await pdf.embedJpg(letterheadBytes); ctx.letterhead = { image: img, marginTop: margins?.margin_top_mm, marginBottom: margins?.margin_bottom_mm }; }
  }
  const w = new Writer(pdf, fonts, ctx);
  await w.newPage();
  const t = quote.totals || {};
  const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "-");

  await w.title("QUOTATION");
  await w.text(`No. ${quote.number}  |  Date: ${date(quote.sent_at || quote.created_at)}${quote.valid_until ? `  |  Valid until: ${date(quote.valid_until)}` : ""}`, { size: 9.5, align: "center", gap: 10, color: rgb(0.42, 0.45, 0.53) });
  await w.text("To,", { size: 10 , gap: 0 });
  await w.text(quote.client_name, { bold: true, gap: 0 });
  for (const l of [quote.client_contact && `Kind attn: ${quote.client_contact}`, quote.client_address, quote.client_gstin && `GSTIN: ${quote.client_gstin}`].filter(Boolean)) await w.text(l, { size: 9.5, gap: 0 });
  w.y -= 8;
  if (quote.subject) await w.text(`Subject: ${quote.subject}`, { bold: true, gap: 8 });

  await w.table(
    [{ label: "#", w: 0.05 }, { label: "Description", w: 0.41 }, { label: "HSN/SAC", w: 0.1 }, { label: "Qty", w: 0.09 }, { label: "Rate", w: 0.12 }, { label: "GST", w: 0.07 }, { label: "Amount", w: 0.16 }],
    (t.items || []).map((l, i) => [String(i + 1), l.desc, l.hsn || "", `${l.qty}${l.unit ? " " + l.unit : ""}`, rs(l.rate), `${l.gst}%`, rs(l.amount)]),
  );
  const sums = [["Sub-total", rs(t.subtotal)]];
  if (t.discount) sums.push(["Less: discount", `- ${rs(t.discount)}`], ["Taxable value", rs(t.taxable)]);
  if (t.local) { if (t.cgst) sums.push(["CGST", rs(t.cgst)], ["SGST", rs(t.sgst)]); }
  else if (t.igst) sums.push(["IGST", rs(t.igst)]);
  if (t.round_off) sums.push(["Round off", rs(t.round_off)]);
  sums.push(["Total", rs(t.total)]);
  await w.table([{ label: "", w: 0.7 }, { label: "Rs.", w: 0.3 }], sums, { size: 9.5 });
  await w.text(`Amount in words: ${t.words || ""}`, { size: 9.5, bold: true, gap: 10 });
  if (quote.terms) { await w.text("Terms and conditions", { bold: true, gap: 2 }); await w.text(quote.terms, { size: 9.5, gap: 8 }); }
  if (company.bank_account) await w.text(`Bank: ${company.bank_name || ""}  A/c ${company.bank_account}  IFSC ${company.bank_ifsc || ""}`, { size: 9, gap: 10 });
  await w.ensure(60);
  await w.text(`For ${company.legal_name}`, { align: "right", gap: 26 });
  await w.text(company.signatory_name || "Authorised Signatory", { align: "right", bold: true, gap: 0 });
  if (company.signatory_designation) await w.text(company.signatory_designation, { align: "right", size: 9.5 });
  return await pdf.save();
}
