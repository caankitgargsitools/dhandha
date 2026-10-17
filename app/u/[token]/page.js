import { redirect } from "next/navigation";
import { anonClient } from "@/lib/supabase/anon";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

async function unsubscribe(formData) {
  "use server";
  const t = String(formData.get("t") || "");
  if (/^[0-9a-f-]{36}$/i.test(t)) await anonClient().rpc("outreach_unsubscribe", { p_token: t });
  redirect(`/u/${t}?done=1`);
}

// A button rather than an automatic unsubscribe on page load: mail scanners open links, people press buttons.
export default async function Unsubscribe({ params, searchParams }) {
  const { token } = await params;
  const done = (await searchParams)?.done;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="panel stack" style={{ maxWidth: 440, width: "100%" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{done ? "You are unsubscribed" : "Unsubscribe from these emails?"}</h1>
        {done ? <p className="muted" style={{ margin: 0 }}>You will not get more marketing emails from this business.</p> : (
          <form action={unsubscribe} className="stack">
            <input type="hidden" name="t" value={token} />
            <p className="muted" style={{ margin: 0 }}>You will stop getting marketing emails from this business.</p>
            <div><button>Unsubscribe</button></div>
          </form>
        )}
        <p className="tiny faint" style={{ margin: 0 }}>Sent using Dhandha.</p>
      </div>
    </main>
  );
}
