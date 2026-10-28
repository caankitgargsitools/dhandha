import { notFound } from "next/navigation";
import { anonClient } from "@/lib/supabase/anon";
import EnquiryForm from "./EnquiryForm";

export const metadata = { title: "Contact us", robots: { index: false } };

// A hosted enquiry page for businesses without a website (share the link on WhatsApp, Instagram bio, visiting card QR).
export default async function Enquiry({ params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token || "")) notFound();
  const { data: cfg } = await anonClient().rpc("web_widget_view", { p_token: token });
  if (!cfg) notFound();
  return (
    <main style={{ maxWidth: 440, margin: "40px auto", padding: "0 16px" }}>
      <div className="panel stack-sm">
        <h1 style={{ fontSize: 24, margin: 0 }}>{cfg.company}</h1>
        <p className="muted" style={{ margin: 0 }}>{cfg.greeting}</p>
        <EnquiryForm token={token} askEmail={cfg.ask_email} />
        {cfg.whatsapp && <a className="btn ghost" href={`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(`Hello ${cfg.company}, I have a question.`)}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>}
      </div>
      <p className="tiny faint" style={{ textAlign: "center" }}>Powered by Dhandha</p>
    </main>
  );
}
