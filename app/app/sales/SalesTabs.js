"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/app/sales", "Team calendar"], ["/app/sales/day", "My day"], ["/app/sales/team", "Salespeople"], ["/app/sales/types", "Meeting types"]];

export default function SalesTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Sales team" className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {TABS.map(([href, label]) => <Link key={href} href={href} className={`btn sm ${path === href ? "" : "ghost"}`} aria-current={path === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
