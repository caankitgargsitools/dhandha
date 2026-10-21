import Link from "next/link";
import Icon from "@/components/Icon";
import { razorpayReady } from "@/lib/razorpay";
import { emailReady } from "@/lib/outreach";
import { driveReady } from "@/lib/google";
import { metaReady } from "@/lib/meta";

// Everything the owner has to switch on outside the code, in one list.
export default async function GoLive({ supabase }) {
  const [{ data: hook }, { data: billing }, { data: appUrl }, { count: runs }, { count: mca }, { count: demo }] = await Promise.all([
    supabase.rpc("billing_webhook_ready"),
    supabase.from("billing_settings").select("seller_gstin, seller_state").eq("id", 1).maybeSingle(),
    supabase.rpc("admin_get_app_url"),
    supabase.from("crawl_runs").select("id", { count: "exact", head: true }).not("source", "like", "MCA:%"),
    supabase.from("mca_companies").select("cin", { count: "exact", head: true }).neq("source", "demo"),
    supabase.from("demo_seed").select("row_id", { count: "exact", head: true }),
  ]);
  const items = [
    [razorpayReady() && !!hook && !!billing?.seller_gstin, "Payments (Razorpay)", "/admin/billing"],
    [!!appUrl, "Site address for background sending", "/admin/outreach"],
    [emailReady(), "Email service (Resend keys in Vercel)", "/admin/outreach"],
    [driveReady(), "Google Drive sign-in (Google keys in Vercel)", null],
    [metaReady() && Boolean(process.env.META_VERIFY_TOKEN), "Facebook / Instagram lead ads (Meta app keys in Vercel + meta_app_secret in Vault)", null],
    [Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY), "AI keys for tender reading", "/admin/ai"],
    [(runs || 0) > 0, "Crawler server running", "/admin/crawler"],
    [(mca || 0) > 0, "First MCA new-companies file uploaded", "/admin/mca"],
    [(demo || 0) === 0, `Demo data removed${demo ? ` (${demo} rows left)` : ""}`, null],
  ];
  const done = items.filter(([ok]) => ok).length;
  return (
    <div className="panel">
      <div className="panel-head"><h3>Go-live checklist</h3><span className="faint small">{done} of {items.length} done</span></div>
      <ul className="reasons">
        {items.map(([ok, label, href]) => (
          <li key={label}><Icon name={ok ? "check" : "alert"} size={14} style={{ color: ok ? "var(--ok)" : "var(--marigold)" }} />
            <span>{href && !ok ? <Link href={href}>{label}</Link> : label}</span></li>
        ))}
      </ul>
    </div>
  );
}
