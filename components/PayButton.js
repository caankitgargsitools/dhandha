"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startCheckout } from "@/app/app/wallet/actions";

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Opens Razorpay Checkout for a top-up or plan. `getOrder` returns the startCheckout() input at click time.
export default function PayButton({ getOrder, label, className = "gold", disabled }) {
  const router = useRouter();
  const [state, setState] = useState({});
  async function pay() {
    setState({ busy: true });
    const ok = await loadCheckout();
    if (!ok) return setState({ error: "Could not load Razorpay. Check your internet connection." });
    const o = await startCheckout(getOrder());
    if (o.error) return setState({ error: o.error });
    const rzp = new window.Razorpay({
      key: o.keyId, order_id: o.orderId, amount: o.amount, currency: "INR", name: o.name, description: o.description,
      prefill: o.prefill, theme: { color: "#8c1d2f" },
      handler: () => {
        setState({ done: true });
        // the webhook usually lands within seconds; refresh a few times to show the new balance
        [3000, 8000, 20000].forEach((ms) => setTimeout(() => router.refresh(), ms));
      },
      modal: { ondismiss: () => setState({}) },
    });
    rzp.on("payment.failed", (r) => setState({ error: r?.error?.description || "Payment failed." }));
    rzp.open();
  }
  return (
    <div className="stack-sm">
      <button type="button" className={className} onClick={pay} disabled={disabled || state.busy}>{state.busy ? "Opening…" : label}</button>
      {state.error && <p className="error" style={{ margin: 0 }}>{state.error}</p>}
      {state.done && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>Payment received. Credits and your GST invoice appear here in a few seconds.</p>}
    </div>
  );
}
