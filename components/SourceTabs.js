"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Lead sources, shown as tabs on each lead page under "Generate leads".
export const LEAD_PAGES = [
  ["/app/leads", "Your leads"],
  ["/app/leads/winners", "Tender winners"],
  ["/app/leads/new-companies", "New companies"],
  ["/app/settings/facebook", "Facebook & Instagram"],
  ["/app/leads/linkedin", "LinkedIn"],
  ["/app/leads/google-maps", "Google Maps"],
  ["/app/leads/apollo", "Apollo"],
  ["/app/leads/databases", "Buy data"],
  ["/app/leads/google-ads", "Google Ads"],
  ["/app/leads/google-profile", "Google Profile"],
  ["/app/leads/autopilot", "Autopilot"],
  ["/app/leads/results", "Results"],
];

export default function SourceTabs() {
  const path = usePathname();
  if (!LEAD_PAGES.some(([href]) => href === path)) return null; // not on single-lead pages, tenders or the hub
  return (
    <nav aria-label="Generate leads" className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      <Link href="/app/leads/generate" className="btn sm ghost">← Generate leads</Link>
      {LEAD_PAGES.map(([href, label]) => <Link key={href} href={href} className={`btn sm ${path === href ? "" : "ghost"}`} aria-current={path === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
