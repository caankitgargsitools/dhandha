import "server-only";

// Razorpay Orders API. Keys live only in Vercel env (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET).
export const razorpayReady = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: String(receipt).slice(0, 40), notes }),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.description || `Razorpay error ${r.status}`);
  return data;
}
