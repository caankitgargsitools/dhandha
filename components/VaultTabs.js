"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const VAULT_PAGES = [
  ["/app/tenders/preferences", "What we do"],
  ["/app/vault/profile", "Company profile"],
  ["/app/vault/documents", "Documents"],
  ["/app/vault/facts", "Facts"],
  ["/app/vault/experience", "Experience"],
  ["/app/vault/people", "Key people"],
  ["/app/brand", "Letterhead & signature"],
];

// Tab strip on every Business Vault page (not on the Vault home, which shows them as cards).
export default function VaultTabs() {
  const path = usePathname();
  if (path === "/app/vault") return null;
  return (
    <nav aria-label="Business Vault" className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      <Link href="/app/vault" className="btn sm ghost">← Business Vault</Link>
      {VAULT_PAGES.map(([href, label]) => (
        <Link key={href} href={href} className={`btn sm ${path === href || path.startsWith(href + "/") ? "" : "ghost"}`} aria-current={path === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
