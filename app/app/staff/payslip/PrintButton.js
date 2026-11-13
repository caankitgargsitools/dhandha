"use client";
export default function PrintButton() { return <button type="button" className="btn sm ghost no-print" onClick={() => window.print()}>Print / save as PDF</button>; }
