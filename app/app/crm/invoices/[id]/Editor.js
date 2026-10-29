"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeQuote, GST_RATES } from "@/lib/quote";
import { saveInvoice, issueInvoice } from "../actions";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// A GST tax invoice: edit while draft; "Issue" gives it the next number (INV/2026-27/0001) and fixes the lines.
export default function Editor({ id, initial, seller, origin, canEdit }) {
  const router = useRouter();
  const [q, setQ] = useState({ ...initial, lines: initial.totals?.items?.length ? initial.totals.items : initial.lines });
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const draft = !initial.status || initial.status === "draft";
  const locked = !canEdit || !draft;
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));
  const setLine = (i, k, v) => setQ((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const t = useMemo(() => computeQuote(q.lines, { seller, buyer: { gstin: q.client_gstin, state: q.client_state }, discount: q.discount }), [q, seller]);

  const save = (andIssue) => start(async () => {
    setNote(null);
    const r = await saveInvoice(id, q);
    if (r.error) return setNote({ bad: r.error });
    if (andIssue) {
      const s = await issueInvoice(r.id);
      if (s.error) return setNote({ bad: s.error });
    }
    setNote({ ok: andIssue ? "Issued — share the link below with the client." : "Saved." });
    if (!id) router.replace(`/app/crm/invoices/${r.id}`); else router.refresh();
  });

  return (
    <div className="stack">
      <fieldset disabled={locked || pending} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div className="panel">
          <div className="grid-2">
            <label>Client / company name<input value={q.client_name} onChange={(e) => set("client_name", e.target.value)} maxLength={200} /></label>
            <label>Kind attention<input value={q.client_contact || ""} onChange={(e) => set("client_contact", e.target.value)} maxLength={120} /></label>
            <label>Billing address<input value={q.client_address || ""} onChange={(e) => set("client_address", e.target.value)} maxLength={500} /></label>
            <label>Client GSTIN<input value={q.client_gstin || ""} onChange={(e) => set("client_gstin", e.target.value.toUpperCase())} maxLength={15} /></label>
            <label>Place of supply (client state)<input value={q.client_state || ""} onChange={(e) => set("client_state", e.target.value)} maxLength={60} placeholder={seller?.state || ""} /></label>
            <label>Client mobile (for WhatsApp)<input value={q.client_phone || ""} onChange={(e) => set("client_phone", e.target.value)} maxLength={20} /></label>
            <label>Invoice date<input type="date" value={q.invoice_date || ""} onChange={(e) => set("invoice_date", e.target.value)} /></label>
            <label>Due date (empty = your usual days)<input type="date" value={q.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></label>
          </div>
          <label>Subject<input value={q.subject || ""} onChange={(e) => set("subject", e.target.value)} maxLength={300} placeholder="e.g. Professional fees — October 2026" /></label>
        </div>

        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>GST</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i}>
                  <td><input value={l.desc} onChange={(e) => setLine(i, "desc", e.target.value)} maxLength={500} /></td>
                  <td><input value={l.hsn || ""} onChange={(e) => setLine(i, "hsn", e.target.value)} style={{ width: 90 }} /></td>
                  <td><input type="number" min={0} value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} style={{ width: 70 }} /></td>
                  <td><input value={l.unit || ""} onChange={(e) => setLine(i, "unit", e.target.value)} style={{ width: 70 }} placeholder="nos" /></td>
                  <td><input type="number" min={0} value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} style={{ width: 110 }} /></td>
                  <td><select value={l.gst} onChange={(e) => setLine(i, "gst", e.target.value)} style={{ width: 80 }}>{GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}</select></td>
                  <td className="small">{inr((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
                  <td><button type="button" className="ghost sm" onClick={() => set("lines", q.lines.filter((_, j) => j !== i))} title="Remove">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 12 }}><button type="button" className="ghost sm" onClick={() => set("lines", [...q.lines, { desc: "", hsn: "", qty: 1, unit: "", rate: 0, gst: 18 }])}>+ Add a line</button></div>
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel stack-sm">
            <label>Terms / notes<textarea rows={4} value={q.terms || ""} onChange={(e) => set("terms", e.target.value)} maxLength={4000} /></label>
            <label>Discount (₹, before GST)<input type="number" min={0} value={q.discount || 0} onChange={(e) => set("discount", e.target.value)} /></label>
          </div>
          <div className="panel">
            <table className="small"><tbody>
              <tr><td>Sub-total</td><td style={{ textAlign: "right" }}>{inr(t.subtotal)}</td></tr>
              {t.discount > 0 && <tr><td>Discount</td><td style={{ textAlign: "right" }}>− {inr(t.discount)}</td></tr>}
              {t.local ? <><tr><td>CGST</td><td style={{ textAlign: "right" }}>{inr(t.cgst)}</td></tr><tr><td>SGST</td><td style={{ textAlign: "right" }}>{inr(t.sgst)}</td></tr></>
                : <tr><td>IGST</td><td style={{ textAlign: "right" }}>{inr(t.igst)}</td></tr>}
              {t.round_off !== 0 && <tr><td>Round off</td><td style={{ textAlign: "right" }}>{inr(t.round_off)}</td></tr>}
              <tr><td><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{inr(t.total)}</strong></td></tr>
            </tbody></table>
            <p className="tiny faint" style={{ margin: "6px 0 0" }}>{t.words} · {t.local ? "same state: CGST + SGST" : "other state: IGST"}</p>
          </div>
        </div>
      </fieldset>

      <div className="panel row" style={{ gap: 10, alignItems: "flex-end" }}>
        <label style={{ margin: 0 }}>Repeat this invoice<select value={q.repeat_months || ""} onChange={(e) => set("repeat_months", e.target.value)} disabled={!canEdit || pending} style={{ width: "auto" }}>
          <option value="">No — one time</option><option value="1">Every month</option><option value="3">Every 3 months</option><option value="6">Every 6 months</option><option value="12">Every year</option></select></label>
        <span className="tiny faint">Repeating invoices are issued by themselves on the same date with the next number (retainers, AMCs).</span>
      </div>

      {canEdit && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="ghost" onClick={() => save(false)} aria-busy={pending} disabled={pending}>Save</button>
          {draft && <button type="button" onClick={() => save(true)} aria-busy={pending} disabled={pending}>Issue invoice</button>}
          {id && <a className="btn ghost" href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>}
        </div>
      )}
      {note?.bad && <p className="error" style={{ margin: 0 }}>{note.bad}</p>}
      {note?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{note.ok}</p>}
    </div>
  );
}
