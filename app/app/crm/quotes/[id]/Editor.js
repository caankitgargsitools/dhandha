"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeQuote, GST_RATES, lineFromItem } from "@/lib/quote";
import { saveQuote, sendQuote } from "../actions";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Editor({ id, initial, seller, origin, canEdit, catalog = [] }) {
  const router = useRouter();
  const [q, setQ] = useState({ ...initial, lines: initial.totals?.items?.length ? initial.totals.items : initial.lines });
  const [note, setNote] = useState(null);
  const [link, setLink] = useState(initial.token && initial.status !== "draft" ? `${origin}/q/${initial.token}` : null);
  const [pending, start] = useTransition();
  const locked = !canEdit || ["accepted", "declined"].includes(initial.status);
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));
  const setLine = (i, k, v) => setQ((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const t = useMemo(() => computeQuote(q.lines, { seller, buyer: { gstin: q.client_gstin, state: q.client_state }, discount: q.discount }), [q, seller]);

  const save = (andSend) => start(async () => {
    setNote(null);
    const r = await saveQuote(id, q);
    if (r.error) return setNote({ bad: r.error });
    if (andSend) {
      const s = await sendQuote(r.id);
      if (s.error) return setNote({ bad: s.error });
      setLink(`${origin}/q/${s.token}`);
    }
    setNote({ ok: andSend ? "Saved. Send the client the link below." : "Saved." });
    if (!id) router.replace(`/app/crm/quotes/${r.id}`); else router.refresh();
  });
  const wa = link && q.client_phone ? `https://wa.me/91${String(q.client_phone).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Dear ${q.client_contact || q.client_name}, please find our quotation here: ${link}`)}` : null;

  return (
    <fieldset disabled={locked || pending} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
      {["accepted", "declined"].includes(initial.status) && <div className={initial.status === "accepted" ? "notice info" : "notice"}>The client {initial.status} this quotation{initial.responded_name ? ` (${initial.responded_name})` : ""}{initial.response_note ? `: “${initial.response_note}”` : "."}</div>}
      <div className="panel">
        <div className="grid-2">
          <label>Client / company name<input value={q.client_name} onChange={(e) => set("client_name", e.target.value)} maxLength={200} /></label>
          <label>Kind attention<input value={q.client_contact || ""} onChange={(e) => set("client_contact", e.target.value)} maxLength={120} /></label>
          <label>Address<input value={q.client_address || ""} onChange={(e) => set("client_address", e.target.value)} maxLength={500} /></label>
          <label>Client GSTIN<input value={q.client_gstin || ""} onChange={(e) => set("client_gstin", e.target.value.toUpperCase())} maxLength={15} /></label>
          <label>Client state (for CGST/SGST or IGST)<input value={q.client_state || ""} onChange={(e) => set("client_state", e.target.value)} maxLength={60} placeholder={seller?.state || ""} /></label>
          <label>Client mobile (for WhatsApp)<input value={q.client_phone || ""} onChange={(e) => set("client_phone", e.target.value)} maxLength={20} /></label>
        </div>
        <label>Subject<input value={q.subject || ""} onChange={(e) => set("subject", e.target.value)} maxLength={300} placeholder="e.g. Quotation for statutory audit FY 2026-27" /></label>
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
        <div className="row" style={{ padding: 12, gap: 8 }}>
          <button type="button" className="ghost sm" onClick={() => set("lines", [...q.lines, { desc: "", hsn: "", qty: 1, unit: "", rate: 0, gst: 18 }])}>+ Add a line</button>
          {catalog.length > 0 && (
            <select value="" onChange={(e) => { const it = catalog.find((c) => c.id === e.target.value); if (it) set("lines", [...q.lines.filter((l) => l.desc || Number(l.rate)), lineFromItem(it)]); }} style={{ width: "auto" }} aria-label="Add from price list">
              <option value="">+ From price list…</option>{catalog.map((c) => <option key={c.id} value={c.id}>{c.name} · ₹{Number(c.rate).toLocaleString("en-IN")}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <label>Terms and conditions<textarea rows={5} value={q.terms || ""} onChange={(e) => set("terms", e.target.value)} maxLength={4000} /></label>
          <div className="grid-2">
            <label>Valid until<input type="date" value={q.valid_until || ""} onChange={(e) => set("valid_until", e.target.value)} /></label>
            <label>Discount (₹, before GST)<input type="number" min={0} value={q.discount || 0} onChange={(e) => set("discount", e.target.value)} /></label>
          </div>
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

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="ghost" onClick={() => save(false)} aria-busy={pending}>Save</button>
        <button type="button" onClick={() => save(true)} aria-busy={pending}>{initial.status === "draft" || !id ? "Save and get the client link" : "Save and update the link"}</button>
        {id && <a className="btn ghost" href={`/api/quotes/${id}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>}
      </div>
      {note?.bad && <p className="error" style={{ margin: 0 }}>{note.bad}</p>}
      {note?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{note.ok}</p>}
      {link && (
        <div className="panel stack-sm">
          <div className="small">Client link: <code style={{ wordBreak: "break-all" }}>{link}</code></div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="ghost sm" onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
            {wa && <a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
          </div>
          <p className="tiny faint" style={{ margin: 0 }}>The client opens it without logging in, sees the quotation, and accepts or declines. Accepted → the deal is marked Won with this value, and you get a phone alert.</p>
        </div>
      )}
    </fieldset>
  );
}
