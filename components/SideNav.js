"use client";
import { useState } from "react";
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
          {s.items.map((it) => it.children ? <NavGroup key={it.href} it={it} isActive={isActive} /> : (
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

// A menu item with a submenu: opens on hover or tap, and stays open while one of its pages is showing.
function NavGroup({ it, isActive }) {
  const [hover, setHover] = useState(false);
  const [tapped, setTapped] = useState(false);
  const here = isActive(it.href, it);
  const open = here || hover || tapped;
  return (
    <div className="navgroup" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className={`nav${here ? " active" : ""}`} aria-expanded={open} onClick={() => setTapped((v) => !v)}>
        <Icon name={it.icon} />
        <span>{it.label}</span>
        <span className="caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="sub">
          {it.children.map((c) => (
            <Link key={c.href} href={c.href} className={`nav${isActive(c.href, c) ? " active" : ""}`} aria-current={isActive(c.href, c) ? "page" : undefined}>
              <Icon name={c.icon} size={15} />
              <span>{c.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
