"use client";
import { useEffect, useState } from "react";
import { pushSetup, saveDevice, dropDevice, testPush } from "./actions";

const b64ToBytes = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

// Install Dhandha on this phone and switch notifications on or off for this device.
export default function PhoneApp({ devices }) {
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [sub, setSub] = useState(null);
  const [support, setSupport] = useState(true);
  const [perm, setPerm] = useState("default");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setInstallable(!!window.__dhInstall);
    const on = () => setInstallable(true);
    window.addEventListener("dh-installable", on);
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupport(ok);
    if (ok) { setPerm(Notification.permission); navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then(setSub); }
    return () => window.removeEventListener("dh-installable", on);
  }, []);

  async function install() {
    const p = window.__dhInstall;
    if (!p) return;
    p.prompt();
    const r = await p.userChoice;
    if (r.outcome === "accepted") { setInstalled(true); setMsg("Installed — Dhandha is on your home screen."); }
    window.__dhInstall = null; setInstallable(false);
  }

  async function turnOn() {
    setBusy(true); setMsg("");
    try {
      const { publicKey } = await pushSetup();
      if (!publicKey) { setMsg("Notifications are being set up by Dhandha — try again in a little while."); return; }
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") { setMsg("Notifications are blocked for this site. Allow them in the browser's site settings, then try again."); return; }
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
      const j = s.toJSON();
      const r = await saveDevice({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || "This device" });
      if (r.error) { setMsg(r.error); return; }
      setSub(s);
      await testPush();
      setMsg("Notifications are on. A test notification is on its way.");
    } catch (e) { setMsg(`Could not turn on notifications: ${e.message}`); } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true);
    await dropDevice({ endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
    setSub(null); setBusy(false); setMsg("Notifications are off on this device.");
  }

  return (
    <div className="stack">
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>1. Install Dhandha on this phone</h3>
        {installed ? <p className="small" style={{ margin: 0 }}><span className="chip ok">Installed</span> You are using the Dhandha app.</p>
          : installable ? <div><button onClick={install}>Install Dhandha app</button></div>
          : <p className="small muted" style={{ margin: 0 }}>On Android, open this page in <strong>Chrome</strong>, tap the ⋮ menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>). Dhandha then opens full-screen from its own icon. On iPhone, open it in Safari, tap Share → <strong>Add to Home Screen</strong>.</p>}
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>2. Notifications on this device</h3>
        <p className="small muted" style={{ margin: 0 }}>Get a notification when a captcha needs typing, when tender documents are fetched, when new tenders match your company (hourly), and for follow-ups due (every morning at 9).</p>
        {!support ? <p className="small">This browser cannot show notifications. Use Chrome on Android, or install the app first on iPhone.</p>
          : sub ? <div className="row" style={{ gap: 8 }}><span className="chip ok">On for this device</span><button className="ghost sm" disabled={busy} onClick={() => testPush().then(() => setMsg("Test sent."))}>Send a test</button><button className="ghost sm" disabled={busy} onClick={turnOff}>Turn off</button></div>
          : <div><button disabled={busy || perm === "denied"} onClick={turnOn}>{busy ? "Turning on…" : "Turn on notifications"}</button>{perm === "denied" && <p className="small" style={{ color: "var(--blood)" }}>Blocked in the browser. Allow notifications for this site in the browser's settings first.</p>}</div>}
        {devices.length > 0 && <div className="tiny faint">Your devices with notifications: {devices.map((d) => d.device || "device").join(" · ")}</div>}
      </div>
      {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}
