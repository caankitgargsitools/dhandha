"use client";
import { useEffect } from "react";

// Registers the phone app's service worker and keeps Chrome's install prompt for the "Install app" button.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const keep = (e) => { e.preventDefault(); window.__dhInstall = e; window.dispatchEvent(new Event("dh-installable")); };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);
  return null;
}
