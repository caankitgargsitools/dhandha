"use client";
import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/readiness";

// ticks every minute; red under 48 hours
export default function Countdown({ dueAt, initial }) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (!dueAt) return;
    const t = setInterval(() => setLeft(timeLeft(dueAt)), 60000);
    return () => clearInterval(t);
  }, [dueAt]);
  return <span className={`chip ${left.tone}`} title={dueAt ? new Date(dueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""} style={{ fontWeight: 700 }}>{left.text === "Closed" ? "Closed" : `${left.text} left`}</span>;
}
