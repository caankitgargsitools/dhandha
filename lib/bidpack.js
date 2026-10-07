import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

// ---------- helpers ----------
const MM = 2.8346;
const A4 = [595.28, 841.89];
const INK = rgb(0.11, 0.13, 0.25), GREY = rgb(0.42, 0.45, 0.53), RULE = rgb(0.8, 0.82, 0.86);

// Standard PDF fonts only cover Latin-1; replace the few characters Indian documents use most.
export function clean(s) {
  return String(s ?? "").replace(/₹/g, "Rs. ").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}
export function inrWords(n) {
  const num = Math.round(Number(n || 0));
  if (!num) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`);
  const three = (x) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x));
  const parts = [];
  const cr = Math.floor(num / 1e7), lk = Math.floor((num % 1e7) / 1e5), th = Math.floor((num % 1e5) / 1e3), rest = num % 1e3;
  if (cr) parts.push(`${cr >= 100 ? three(cr) : two(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}
export const rs = (n) => (n === null || n === undefined || n === "" ? "-" : `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n))}`);
const d8 = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

class Writer {
  constructor(pdf, fonts, ctx) { Object.assign(this, { pdf, fonts, ctx }); }
  async newPage() {
    const { letterhead, company, draft } = this.ctx;
    const page = this.pdf.addPage(A4);
    const [W, H] = A4;
    if (letterhead?.embedded) page.drawPage(letterhead.embedded, { x: 0, y: 0, width: W, height: H });
    else if (letterhead?.image) page.drawImage(letterhead.image, { x: 0, y: 0, width: W, height: H });
    else {
      page.drawText(clean(company.legal_name), { x: 50, y: H - 52, size: 15, font: this.fonts.bold, color: INK });
      const addr = clean([company.registered_address, company.city, company.state, company.pincode].filter(Boolean).join(", "));
      page.drawText(addr, { x: 50, y: H - 68, size: 8.5, font: this.fonts.reg, color: GREY });
      page.drawText(clean([company.gstin && `GSTIN ${company.gstin}`, company.cin && `CIN ${company.cin}`, company.email, company.phone].filter(Boolean).join("   |   ")), { x: 50, y: H - 80, size: 8, font: this.fonts.reg, color: GREY });
      page.drawLine({ start: { x: 50, y: H - 88 }, end: { x: W - 50, y: H - 88 }, thickness: 0.8, color: rgb(0.55, 0.11, 0.18) });
    }
    if (draft) page.drawText("DRAFT - NOT SIGNED", { x: 120, y: 300, size: 54, font: this.fonts.bold, color: rgb(0.85, 0.2, 0.25), opacity: 0.12, rotate: degrees(35) });
    const top = letterhead ? (letterhead.marginTop || 45) * MM : 105;
    const bottom = letterhead ? (letterhead.marginBottom || 25) * MM : 60;
    this.page = page; this.y = H - top - 10; this.bottom = bottom + 10; this.x = 56; this.w = W - 112;
    this.pages = (this.pages || 0) + 1;
    return page;
  }
  ensure(h) { if (this.y - h < this.bottom) return this.newPage(); }
  lines(text, size, font, width) {
    const out = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  async text(t, { size = 10.5, bold = false, gap = 4, color = INK, indent = 0, align } = {}) {
    const font = bold ? this.fonts.bold : this.fonts.reg;
    for (const l of this.lines(t, size, font, this.w - indent)) {
      await this.ensure(size + 3);
      const x = align === "right" ? this.x + this.w - font.widthOfTextAtSize(l, size) : align === "center" ? this.x + (this.w - font.widthOfTextAtSize(l, size)) / 2 : this.x + indent;
      this.page.drawText(l, { x, y: this.y - size, size, font, color });
      this.y -= size + 3.5;
    }
    this.y -= gap;
  }
  async title(t) { await this.ensure(40); await this.text(t, { size: 13, bold: true, align: "center", gap: 10 }); }
  async table(cols, rows, { size = 9 } = {}) {
    const widths = cols.map((c) => c.w * this.w);
    const drawRow = async (cells, bold) => {
      const wrapped = cells.map((c, i) => this.lines(c, size, bold ? this.fonts.bold : this.fonts.reg, widths[i] - 8));
      const h = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + 8;
      await this.ensure(h);
      let x = this.x;
      wrapped.forEach((ls, i) => {
        this.page.drawRectangle({ x, y: this.y - h, width: widths[i], height: h, borderColor: RULE, borderWidth: 0.6, color: bold ? rgb(0.95, 0.96, 0.97) : undefined });
        ls.forEach((l, j) => this.page.drawText(l, { x: x + 4, y: this.y - 4 - (j + 1) * (size + 3) + 3, size, font: bold ? this.fonts.bold : this.fonts.reg, color: INK }));
        x += widths[i];
      });
      this.y -= h;
    };
    await drawRow(cols.map((c) => c.label), true);
    for (const r of rows) await drawRow(r.map((v) => clean(v)), false);
    this.y -= 10;
  }
  async signature() {
    const { company, signature, seal, draft, place, date } = this.ctx;
    await this.ensure(120);
    this.y -= 8;
    const left = this.x + this.w - 210;
    if (!draft && signature) { const s = signature.scaleToFit(150, 48); this.page.drawImage(signature, { x: left, y: this.y - s.height, width: s.width, height: s.height }); }
    if (!draft && seal) { const s = seal.scaleToFit(70, 70); this.page.drawImage(seal, { x: left - 90, y: this.y - s.height - 6, width: s.width, height: s.height, opacity: 0.9 }); }
    this.y -= 54;
    for (const [t, b] of [[draft ? "(signature)" : "", false], [company.signatory_name || "Authorised Signatory", true], [company.signatory_designation || "", false], [`For ${company.legal_name}`, false]]) {
      if (!t) continue;
      this.page.drawText(clean(t), { x: left, y: this.y - 10, size: 9.5, font: b ? this.fonts.bold : this.fonts.reg, color: INK });
      this.y -= 13;
    }
    this.page.drawText(clean(`Place: ${place}`), { x: this.x, y: this.y + 26, size: 9.5, font: this.fonts.reg, color: INK });
    this.page.drawText(clean(`Date: ${date}`), { x: this.x, y: this.y + 13, size: 9.5, font: this.fonts.reg, color: INK });
    this.y -= 6;
  }
}

// Documents a bid normally asks for, by industry pack.
export function requiredDocs(pack, msme, fromTender) {
  if (Array.isArray(fromTender) && fromTender.length) {
    const must = ["REG-PAN", "REG-GST", "LEG-POA", "DSC"];
    return [...new Set([...must, ...fromTender, ...(msme ? ["REG-UDYAM"] : [])])];
  }
  const base = ["REG-PAN", "REG-GST", "REG-INC", "FIN-AUDIT", "FIN-ITR", "FIN-CA-CERT", "EXP-CC", "LEG-POA", "DSC"];
  const extra = { construction: ["CERT-CONTR", "FIN-SOLV", "CERT-EPF", "CERT-ESI", "CERT-LAB"], it_services: ["CERT-ISO", "CERT-EPF", "CERT-ESI", "CERT-LAB"], ca_audit: ["CERT-ICAI", "CERT-PEER"], goods_supply: ["CERT-ISO"] }[pack] || [];
  return [...base, ...extra, ...(msme ? ["REG-UDYAM"] : [])];
}

// ---------- the pack ----------
export async function buildBidPack(ctx) {
  const { tender, company, facts, works, people, docs, docTypes, draft } = ctx;
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(`Bid documents - ${tender.title}`));
  pdf.setAuthor(clean(company.legal_name));
  pdf.setCreator("Dhandha");
  const fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  if (ctx.letterheadBytes) {
    if (ctx.letterheadType === "pdf") { const [e] = await pdf.embedPdf(ctx.letterheadBytes, [0]); ctx.letterhead = { embedded: e, marginTop: ctx.margins?.margin_top_mm, marginBottom: ctx.margins?.margin_bottom_mm }; }
    else { const img = ctx.letterheadType === "png" ? await pdf.embedPng(ctx.letterheadBytes) : await pdf.embedJpg(ctx.letterheadBytes); ctx.letterhead = { image: img, marginTop: ctx.margins?.margin_top_mm, marginBottom: ctx.margins?.margin_bottom_mm }; }
  }
  if (!draft && ctx.signatureBytes) ctx.signature = await pdf.embedPng(ctx.signatureBytes);
  if (!draft && ctx.sealBytes) ctx.seal = await pdf.embedPng(ctx.sealBytes);
  ctx.date = d8(new Date());
  ctx.place = company.city || company.state || "";
  const w = new Writer(pdf, fonts, ctx);
  const annexures = [];
  const msme = ["micro", "small"].includes(company.msme_category) && company.udyam_no;
  const turnover = facts.filter((f) => f.key === "fin.turnover").sort((a, b) => b.period.localeCompare(a.period)).slice(0, 3);
  const networth = facts.filter((f) => f.key === "fin.net_worth").sort((a, b) => b.period.localeCompare(a.period))[0];
  const avg = turnover.length ? turnover.reduce((s, f) => s + Number(String(f.value).replace(/[^0-9.]/g, "")), 0) / turnover.length : null;
  const ref = `${tender.tender_ref}`;
  const sub = `Sub: Submission of bid for "${tender.title}" - Tender ID ${ref}`;

  // 1. Covering letter
  await w.newPage(); annexures.push("Covering letter");
  await w.text(`Ref: ${company.trade_name || company.legal_name}/BID/${new Date().getFullYear()}/${ref.slice(-6)}`, { size: 9.5, color: GREY });
  await w.text(`Date: ${ctx.date}`, { size: 9.5, color: GREY, gap: 12 });
  await w.text("To,"); await w.text(`The Tender Inviting Authority\n${tender.authority}${tender.department ? "\n" + tender.department : ""}${tender.district ? "\n" + tender.district : ""}${tender.state ? ", " + tender.state : ""}`, { gap: 12 });
  await w.text(sub, { bold: true, gap: 10 });
  await w.text("Dear Sir / Madam,", { gap: 8 });
  await w.text(`With reference to the above tender published on ${tender.portal}, we, ${company.legal_name}, hereby submit our bid. We have read and understood all terms and conditions of the tender document, including corrigenda issued up to the date of submission, and agree to abide by them.`);
  await w.text(`Our bid shall remain valid for the period specified in the tender. ${msme ? `Being a ${company.msme_category} enterprise registered under Udyam (${company.udyam_no}), we request exemption from Earnest Money Deposit as per the Public Procurement Policy for Micro and Small Enterprises.` : tender.emd_inr ? `Earnest Money Deposit of ${rs(tender.emd_inr)} (Rupees ${inrWords(tender.emd_inr)} only) is being submitted as specified.` : ""}`);
  await w.text("We enclose the following documents:", { gap: 4 });
  const encl = ["Annexure A - Bidder information", "Annexure B - Financial turnover and net worth", "Annexure C - Similar works completed", "Annexure D - Key personnel", "Annexure E - Declaration regarding blacklisting / debarment", ...(msme ? ["Annexure F - Declaration for MSE benefits"] : []), "Annexure G - Checklist of documents"];
  for (const [i, e] of encl.entries()) await w.text(`${i + 1}. ${e}`, { indent: 14, gap: 0 });
  w.y -= 8;
  await w.text("Yours faithfully,");
  await w.signature();

  // A. Bidder information
  await w.newPage(); annexures.push("Annexure A - Bidder information");
  await w.title("Annexure A - Bidder Information Form");
  await w.text(sub, { size: 9.5, color: GREY, gap: 10 });
  const cons = { proprietorship: "Proprietorship", partnership: "Partnership firm", llp: "Limited Liability Partnership", private_limited: "Private Limited Company", public_limited: "Public Limited Company", opc: "One Person Company", trust: "Trust", society: "Society", other: "Other" };
  await w.table([{ label: "Particulars", w: 0.38 }, { label: "Details", w: 0.62 }], [
    ["Name of the bidder", company.legal_name], ["Constitution", cons[company.constitution] || "-"],
    ["Date of incorporation / registration", d8(company.incorporation_date)], ["Registered address", [company.registered_address, company.city, company.state, company.pincode].filter(Boolean).join(", ") || "-"],
    ["PAN", company.pan || "-"], ["GSTIN", company.gstin || "-"], ["CIN / LLPIN", company.cin || "-"],
    ["Udyam registration", company.udyam_no ? `${company.udyam_no} (${company.msme_category || "-"})` : "Not registered"],
    ["Contact email / phone", [company.email, company.phone].filter(Boolean).join(" / ") || "-"], ["Website", company.website || "-"],
    ["Authorised signatory", [company.signatory_name, company.signatory_designation].filter(Boolean).join(", ") || "-"], ["Signatory mobile", company.signatory_mobile || "-"],
    ["Bank for refund of EMD", [company.bank_name, company.bank_account && `A/c ${company.bank_account}`, company.bank_ifsc && `IFSC ${company.bank_ifsc}`].filter(Boolean).join(", ") || "-"],
  ]);
  await w.text("We certify that the information given above is true and correct.");
  await w.signature();

  // B. Turnover
  await w.newPage(); annexures.push("Annexure B - Financial turnover");
  await w.title("Annexure B - Financial Turnover and Net Worth");
  await w.text(sub, { size: 9.5, color: GREY, gap: 10 });
  await w.table([{ label: "Financial year", w: 0.3 }, { label: "Annual turnover", w: 0.35 }, { label: "Source", w: 0.35 }],
    turnover.length ? turnover.map((f) => [f.period, rs(String(f.value).replace(/[^0-9.]/g, "")), "Audited financial statements"]) : [["-", "Not available in Vault", "-"]]);
  await w.text(`Average annual turnover of the last ${turnover.length || 3} financial years: ${avg ? `${rs(Math.round(avg))} (Rupees ${inrWords(avg)} only)` : "-"}`, { bold: true });
  if (networth) await w.text(`Net worth as on 31 March (${networth.period}): ${rs(String(networth.value).replace(/[^0-9.]/g, ""))}`);
  await w.text("The figures are as per our audited balance sheets; the Chartered Accountant's certificate is enclosed separately.", { size: 9.5, color: GREY });
  await w.signature();

  // C. Similar works
  await w.newPage(); annexures.push("Annexure C - Similar works");
  await w.title("Annexure C - Statement of Similar Works Completed");
  await w.text(sub, { size: 9.5, color: GREY, gap: 10 });
  const done = works.filter((x) => x.status === "completed").sort((a, b) => Number(b.value_inr) - Number(a.value_inr));
  await w.table([{ label: "#", w: 0.05 }, { label: "Name of work", w: 0.33 }, { label: "Client", w: 0.2 }, { label: "Value", w: 0.15 }, { label: "Start", w: 0.135 }, { label: "Completion", w: 0.135 }],
    done.length ? done.map((x, i) => [String(i + 1), x.work_name, x.client, rs(x.value_inr), d8(x.start_date), d8(x.end_date)]) : [["-", "No completed works in Vault", "-", "-", "-", "-"]]);
  const ongoing = works.filter((x) => x.status === "ongoing");
  if (ongoing.length) {
    await w.text("Works in progress", { bold: true });
    await w.table([{ label: "Name of work", w: 0.45 }, { label: "Client", w: 0.3 }, { label: "Value", w: 0.25 }], ongoing.map((x) => [x.work_name, x.client, rs(x.value_inr)]));
  }
  await w.text("Completion certificates from the clients are enclosed.", { size: 9.5, color: GREY });
  await w.signature();

  // D. Key personnel
  await w.newPage(); annexures.push("Annexure D - Key personnel");
  await w.title("Annexure D - Key Personnel");
  await w.text(sub, { size: 9.5, color: GREY, gap: 10 });
  await w.table([{ label: "#", w: 0.06 }, { label: "Name", w: 0.28 }, { label: "Designation", w: 0.24 }, { label: "Qualification", w: 0.24 }, { label: "Experience", w: 0.18 }],
    people.length ? people.map((p, i) => [String(i + 1), p.name, p.designation || "-", p.qualification || "-", p.years_experience ? `${p.years_experience} years` : "-"]) : [["-", "No key people in Vault", "-", "-", "-"]]);
  await w.signature();

  // E. Non-blacklisting
  await w.newPage(); annexures.push("Annexure E - Non-blacklisting declaration");
  await w.title("Annexure E - Declaration Regarding Blacklisting / Debarment");
  await w.text(sub, { size: 9.5, color: GREY, gap: 12 });
  await w.text(`I/We, ${company.signatory_name || "the undersigned"}, ${company.signatory_designation || "authorised signatory"} of ${company.legal_name}, hereby declare that our firm/company has not been blacklisted, debarred or banned from business dealings by any Central / State Government department, Public Sector Undertaking or any other government organisation as on the date of submission of this bid, and that no such proceedings are pending against us.`);
  await w.text("We further declare that we have not been convicted of any offence under the Prevention of Corruption Act or any other law, and that the information furnished in this bid is true. If any information is found false at any stage, our bid / contract may be rejected / terminated and the Earnest Money / Performance Security forfeited.");
  await w.signature();

  // F. MSE declaration
  if (msme) {
    await w.newPage(); annexures.push("Annexure F - MSE declaration");
    await w.title("Annexure F - Declaration for Benefits to Micro and Small Enterprises");
    await w.text(sub, { size: 9.5, color: GREY, gap: 12 });
    await w.text(`We hereby declare that ${company.legal_name} is a ${company.msme_category} enterprise registered under Udyam with registration number ${company.udyam_no}, valid as on date. We request the benefits available to Micro and Small Enterprises under the Public Procurement Policy for MSEs Order, 2012 (as amended), including exemption from payment of tender fee and Earnest Money Deposit, where applicable to this tender.`);
    await w.text("A copy of the Udyam registration certificate is enclosed.");
    await w.signature();
  }

  // G. Checklist
  await w.newPage(); annexures.push("Annexure G - Document checklist");
  await w.title("Annexure G - Checklist of Documents Enclosed");
  await w.text(sub, { size: 9.5, color: GREY, gap: 10 });
  const due = tender.due_at ? new Date(tender.due_at) : null;
  const rows = requiredDocs(tender.industry_pack, msme, tender.req_docs).map((code, i) => {
    const have = docs.filter((d) => d.type_code === code);
    const best = have.sort((a, b) => new Date(b.valid_until || "2999-01-01") - new Date(a.valid_until || "2999-01-01"))[0];
    const name = docTypes.find((t) => t.code === code)?.name || code;
    const status = !best ? "To be attached" : best.valid_until && due && new Date(best.valid_until) < due ? `Valid only till ${d8(best.valid_until)} - renew` : "Enclosed";
    return [String(i + 1), name, best ? [best.number, best.period].filter(Boolean).join(" / ") || "-" : "-", status];
  });
  await w.table([{ label: "#", w: 0.06 }, { label: "Document", w: 0.44 }, { label: "Number / period", w: 0.25 }, { label: "Status", w: 0.25 }], rows);
  await w.signature();

  const bytes = await pdf.save();
  return { bytes, annexures, pages: pdf.getPageCount() };
}
