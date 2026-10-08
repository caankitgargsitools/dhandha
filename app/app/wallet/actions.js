"use server";
import { getContext } from "@/lib/session";
import { createRazorpayOrder, razorpayReady } from "@/lib/razorpay";

// Prices the purchase in SQL, opens a Razorpay order for exactly that amount and returns what Checkout needs.
// Credits are added only when Razorpay's signed webhook confirms the payment.
export async function startCheckout({ kind, amount, modules, suite }) {
  const { supabase, company, user, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can pay." };
  if (!razorpayReady()) return { error: "Online payment is not switched on yet. Please contact support." };
  const { data: q, error } = await supabase.rpc("billing_create_order", {
    p_company: company.id, p_kind: kind === "plan" ? "plan" : "topup",
    p_amount: kind === "topup" ? Number(amount) || 0 : null,
    p_modules: Array.isArray(modules) ? modules.map(String).slice(0, 10) : [], p_suite: !!suite,
  });
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  let order;
  try {
    order = await createRazorpayOrder({ amountPaise: q.amount_paise, receipt: q.id, notes: { billing_order_id: q.id, company: company.legal_name.slice(0, 200) } });
  } catch (e) {
    return { error: `Could not start the payment: ${e.message}` };
  }
  const { error: e2 } = await supabase.rpc("billing_attach_order", { p_id: q.id, p_razorpay_order: order.id });
  if (e2) return { error: e2.message };
  const { data: c } = await supabase.from("companies").select("phone, signatory_mobile").eq("id", company.id).maybeSingle();
  return {
    keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: q.amount_paise, name: "Dhandha",
    description: kind === "plan" ? `Plan: ${q.modules.join(", ")}` : `${q.credits} credits`,
    prefill: { name: company.legal_name, email: user.email, contact: c?.signatory_mobile || c?.phone || "" },
  };
}
