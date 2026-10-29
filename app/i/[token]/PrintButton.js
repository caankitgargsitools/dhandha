"use client";
export default function PrintButton() {
  return <button type="button" className="ghost sm" onClick={() => window.print()}>Print / save as PDF</button>;
}
