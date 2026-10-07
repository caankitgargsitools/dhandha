// Hand-drawn SVG charts (no library). All server-renderable.

// Semicircle gauge for a 0–100 value.
export function Gauge({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 70, cx = 90, cy = 88;
  const end = Math.PI * (1 - v / 100);
  const x = cx + r * Math.cos(end), y = cy - r * Math.sin(end);
  return (
    <svg viewBox="0 0 180 104" width="100%" style={{ maxWidth: 220 }} role="img" aria-label={`${label}: ${v}%`}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--line-soft)" strokeWidth="14" strokeLinecap="round" />
      {v > 0 && <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="var(--madder)" strokeWidth="14" strokeLinecap="round" />}
      {[0, 25, 50, 75, 100].map((t) => {
        const a = Math.PI * (1 - t / 100);
        return <line key={t} x1={cx + (r - 12) * Math.cos(a)} y1={cy - (r - 12) * Math.sin(a)} x2={cx + (r - 18) * Math.cos(a)} y2={cy - (r - 18) * Math.sin(a)} stroke="var(--ink-3)" strokeWidth="1.2" />;
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--ink)" style={{ fontFamily: "var(--display)" }}>{v}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="var(--ink-2)">{label}</text>
    </svg>
  );
}

// Ring showing a 0–100 score; colour by band.
export function ScoreRing({ score, size = 52 }) {
  const r = 20, c = 2 * Math.PI * r;
  const col = score >= 75 ? "var(--leaf)" : score >= 50 ? "var(--marigold)" : "var(--blood)";
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="25" cy="25" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="5" />
      <circle cx="25" cy="25" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 25 25)" />
      <text x="25" y="29.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--ink)">{score}</text>
    </svg>
  );
}

// Area sparkline of a running series (e.g. credit balance).
export function Sparkline({ points, height = 64, color = "var(--madder)", label }) {
  if (!points || points.length < 2) return <div className="faint small">Not enough history yet</div>;
  const w = 300, h = height, pad = 4;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [pad + (i / (points.length - 1)) * (w - 2 * pad), h - pad - ((p - min) / span) * (h - 2 * pad)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy.at(-1)[0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`;
  const last = xy.at(-1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  );
}

// Horizontal funnel of stage counts/values.
export function StageBars({ rows, format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "grid", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "92px 1fr 88px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span className="muted" style={{ fontWeight: 600 }}>{r.label}</span>
          <div className="bar" style={{ height: 12 }}><span style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color || "var(--madder)" }} /></div>
          <span className="num" style={{ textAlign: "right", fontWeight: 700 }}>{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Vertical bars by day (e.g. sign-ups over 30 days).
export function DayBars({ days, height = 120, color = "var(--madder)", label }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const w = 600, bw = w / days.length;
  return (
    <svg viewBox={`0 0 ${w} ${height + 18}`} width="100%" role="img" aria-label={label}>
      {[0.5, 1].map((f) => <line key={f} x1="0" x2={w} y1={height - f * (height - 6)} y2={height - f * (height - 6)} stroke="var(--line-soft)" />)}
      {days.map((d, i) => {
        const bh = (d.value / max) * (height - 6);
        return <rect key={i} x={i * bw + 2} y={height - bh} width={Math.max(2, bw - 4)} height={Math.max(bh, d.value ? 2 : 0)} rx="2" fill={color} opacity={i === days.length - 1 ? 1 : 0.75}><title>{`${d.label}: ${d.value}`}</title></rect>;
      })}
      <line x1="0" x2={w} y1={height} y2={height} stroke="var(--ink-3)" strokeWidth="1" />
      <text x="0" y={height + 15} fontSize="11" fill="var(--ink-3)">{days[0]?.label}</text>
      <text x={w} y={height + 15} fontSize="11" fill="var(--ink-3)" textAnchor="end">{days.at(-1)?.label}</text>
    </svg>
  );
}

// Donut of parts of a whole.
export function Donut({ parts, size = 132, center }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 46, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="16" />
      {parts.map((p) => {
        const len = (p.value / total) * c;
        const el = <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="16"
          strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />;
        acc += len;
        return el;
      })}
      {center && <text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--ink)">{center}</text>}
    </svg>
  );
}
