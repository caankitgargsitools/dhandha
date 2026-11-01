"use client";
import { useState } from "react";
import { matchL1 } from "@/lib/gemFields";

const num = (v) => Number(String(v).replace(/[^\d.]/g, "")) || 0;

// GeM purchase preferences at the price step: try your price against an expected L1 and see whether you would be
// asked to match it (MSE / Make in India) and for what share of the order. Free; nothing is saved.
export default function PreferencePanel({ gem, msme, quote, estimate, cost }) {
  const [price, setPrice] = useState(String(quote || cost || ""));
  const [l1, setL1] = useState(String(estimate ? Math.round(estimate * 0.85) : ""));
  const [classOne, setClassOne] = useState(false);
  const [l1Mse, setL1Mse] = useState(false);
  const lines = matchL1({ gem, msme, classOne, ourPrice: num(price), l1Price: num(l1), l1IsMse: l1Mse });
  return (
    <div className="stack-sm" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
      <div className="row between"><strong>Match L1: MSE and Make in India</strong>
        <span className="row" style={{ gap: 6 }}>{gem.mse_preference && <span className="chip info">MSE L1+{gem.mse_margin_pct || 15}%</span>}{gem.mii_preference && <span className="chip info">Make in India</span>}</span></div>
      <div className="form-grid">
        <div><label htmlFor="pp-p">Your price (₹, before GST)</label><input id="pp-p" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div><label htmlFor="pp-l">Expected lowest price (L1, ₹)</label><input id="pp-l" inputMode="numeric" value={l1} onChange={(e) => setL1(e.target.value)} /></div>
      </div>
      <div className="row" style={{ gap: 14 }}>
        {gem.mii_preference && <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={classOne} onChange={(e) => setClassOne(e.target.checked)} /> Our offer has ≥50% local content (Class-I)</label>}
        {gem.mse_preference && <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={l1Mse} onChange={(e) => setL1Mse(e.target.checked)} /> L1 is likely an MSE too</label>}
      </div>
      {lines.length ? lines.map((x) => <div key={x.kind} className="small"><span style={{ color: x.ok ? "var(--leaf)" : "var(--blood)" }}>{x.ok ? "✓" : "✗"}</span> {x.line}</div>)
        : <div className="muted small">Type your price and the expected L1.</div>}
      <div className="tiny faint">GeM's usual rules; the bid's own terms (ATC) win where they differ.{!msme && gem.mse_preference ? " MSE status comes from the Udyam number and category in your Vault." : ""}</div>
    </div>
  );
}
