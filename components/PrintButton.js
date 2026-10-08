"use client";
export default function PrintButton({ label = "Print / save as PDF" }) {
  return <button type="button" className="ghost" onClick={() => window.print()}>{label}</button>;
}
