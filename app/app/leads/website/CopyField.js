"use client";

export default function CopyField({ label, value }) {
  return (
    <div><label>{label}</label>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input readOnly value={value} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />
        <button type="button" className="sm ghost" onClick={() => navigator.clipboard?.writeText(value)}>Copy</button>
      </div>
    </div>
  );
}
