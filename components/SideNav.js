"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

// The ☰ button in the top bar; it opens the menu drawer.
export function MenuButton() {
  return (
    <button type="button" className="burger" aria-label="Open menu" onClick={() => window.dispatchEvent(new Event("dh-menu"))}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
  );
}

export default function SideNav({ sections, admin = false, foot }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("dh-menu", toggle);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("dh-menu", toggle); window.removeEventListener("keydown", esc); };
  }, []);
  useEffect(() => { setOpen(false); }, [path]); // a menu choice closes the drawer
  const under = (href) => path === href || path.startsWith(href + "/");
  // an item can cover several sections (match) or leave one out (exclude)
  const isActive = (href, it = {}) => (href === "/app" || href === "/admin" ? path === href
    : (it.match || [href]).some(under) && !(it.exclude || []).some(under));
  return (
    <>
    {open && <div className="side-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    <nav className={`side${admin ? " admin" : ""}${open ? " open" : ""}`} aria-label="Main" inert={!open}>
      <button type="button" className="close" aria-label="Close menu" onClick={() => setOpen(false)}>×</button>
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
    </>
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
