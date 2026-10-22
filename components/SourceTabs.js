"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SOURCE_PAGES = [
  ["/app/tenders", "Tenders"],
  ["/app/leads", "Leads"],
  ["/app/settings/facebook", "Facebook & Instagram"],
  ["/app/leads/linkedin", "LinkedIn"],
];
// list pages that carry the strip (not a single tender's or lead's page, not "What we do")
const SHOWN = ["/app/tenders", "/app/leads", "/app/leads/winners", "/app/leads/new-companies", "/app/leads/linkedin", "/app/settings/facebook"];

export default function SourceTabs() {
  const path = usePathname();
  if (!SHOWN.includes(path)) return null;
  const active = (href) => href === "/app/leads" ? path.startsWith("/app/leads") && path !== "/app/leads/linkedin" : path === href;
  return (
    <nav aria-label="Source new business" className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      <Link href="/app/source" className="btn sm ghost">← Source new business</Link>
      {SOURCE_PAGES.map(([href, label]) => <Link key={href} href={href} className={`btn sm ${active(href) ? "" : "ghost"}`} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
