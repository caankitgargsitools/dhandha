"use client";
import { useState } from "react";
import PayButton from "./PayButton";
import { quote, planQuote, TOPUP_PACKS } from "@/lib/billing";

const rs = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function TopUp({ gstRate, minTopup, disabled }) {
  const [amount, setAmount] = useState(1000);
  const q = quote(amount, gstRate);
  const ok = amount >= minTopup && amount <= 500000;
  return (
    <div className="stack-sm">
      <div className="row" style={{ gap: 8 }}>
        {TOPUP_PACKS.map((p) => <button key={p} type="button" className={`sm ${amount === p ? "" : "ghost"}`} onClick={() => setAmount(p)}>{p.toLocaleString("en-IN")} credits</button>)}
      </div>
      <div><label htmlFor="topup">Or enter credits (1 credit = ₹1)</label>
        <input id="topup" inputMode="numeric" value={amount || ""} onChange={(e) => setAmount(Math.round(Number(e.target.value.replace(/\D/g, "")) || 0))} style={{ maxWidth: 200 }} /></div>
      <div className="small">{rs(q.base)} + {gstRate}% GST {rs(q.gst)} = <strong>{rs(q.total)}</strong></div>
      {!ok && <p className="tiny faint" style={{ margin: 0 }}>Between {rs(minTopup)} and ₹5,00,000.</p>}
      <PayButton label={`Pay ${rs(q.total)}`} disabled={disabled || !ok} getOrder={() => ({ kind: "topup", amount })} />
    </div>
  );
}

export function PlanPicker({ modules, active, gstRate, suiteFee, suiteCredits, disabled }) {
  const [chosen, setChosen] = useState(modules.filter((m) => m.code !== "platform" && active.includes(m.code)).map((m) => m.code));
  const [suite, setSuite] = useState(false);
  const q = planQuote(modules, chosen, { suite, suiteFee, suiteCredits, gstRate });
  const toggle = (c) => setChosen((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const separately = planQuote(modules, modules.map((m) => m.code), { gstRate }).base;
  return (
    <div className="stack-sm">
      <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
        <input type="checkbox" checked={suite} onChange={(e) => setSuite(e.target.checked)} style={{ width: "auto" }} />
        Full suite: all modules and {Number(suiteCredits).toLocaleString("en-IN")} credits for {rs(suiteFee)} <span className="faint">(₹{separately.toLocaleString("en-IN")} separately)</span>
      </label>
      {!suite && modules.map((m) => (
        <label key={m.code} className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={m.code === "platform" || chosen.includes(m.code)} disabled={m.code === "platform"} onChange={() => toggle(m.code)} style={{ width: "auto" }} />
          <span><strong>{m.name}</strong> {rs(m.monthly_fee_inr)} · {Number(m.included_credits)} credits{m.code === "platform" ? " (always included)" : ""}</span>
        </label>
      ))}
      <div className="small">30 days: {rs(q.base)} + {gstRate}% GST {rs(q.gst)} = <strong>{rs(q.total)}</strong>, with {q.credits.toLocaleString("en-IN")} credits added.</div>
      <PayButton label={`Pay ${rs(q.total)}`} disabled={disabled} getOrder={() => ({ kind: "plan", modules: chosen, suite })} />
      <p className="tiny faint" style={{ margin: 0 }}>Paying again before the period ends adds 30 more days.</p>
    </div>
  );
}
