"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export default function SideNav({ sections, admin = false, foot }) {
  const path = usePathname();
  const under = (href) => path === href || path.startsWith(href + "/");
  // an item can cover several sections (match) or leave one out (exclude)
  const isActive = (href, it = {}) => (href === "/app" || href === "/admin" ? path === href
    : (it.match || [href]).some(under) && !(it.exclude || []).some(under));
  return (
    <nav className={`side${admin ? " admin" : ""}`} aria-label="Main">
      <Link href={admin ? "/admin" : "/app"} className="wordmark"><span>Dhandha</span><span className="dot" /><small style={admin ? { fontFamily: "var(--body)", fontWeight: 700 } : undefined}>{admin ? "Admin" : "धंधा"}</small></Link>
      {sections.map((s, i) => (
        <div key={i} style={{ display: "contents" }}>
          {s.title && <div className="group">{s.title}</div>}
          {s.items.map((it) => (
            <Link key={it.href} href={it.href} className={`nav${isActive(it.href, it) ? " active" : ""}`} aria-current={isActive(it.href, it) ? "page" : undefined}>
              <Icon name={it.icon} />
              <span>{it.label}</span>
              {it.tag && <span className="tag">{it.tag}</span>}
            </Link>
          ))}
        </div>
      ))}
      {foot && <div className="foot">{foot}</div>}
    </nav>
  );
}
