import { anonClient } from "@/lib/supabase/anon";
import Form from "./Form";

export const metadata = { title: "Refer a friend", robots: { index: false } };

// A happy customer's referral page (no login): they send a friend's details; it arrives as a lead with "referred by".
export default async function Referral({ params }) {
  const { token } = await params;
  const { data: v } = /^[0-9a-f-]{36}$/i.test(token) ? await anonClient().rpc("referral_view", { p_token: token }) : { data: null };
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "start center", padding: "40px 16px" }}>
      <div className="panel stack" style={{ maxWidth: 620, width: "100%" }}>
        {!v ? <><h1 style={{ fontSize: 22, margin: 0 }}>Link not valid</h1></> : (
          <>
            <div>
              <div className="tiny faint">{v.business}</div>
              <h1 style={{ fontSize: 24, margin: "2px 0 4px" }}>Know someone who could use our help?</h1>
              <p className="muted" style={{ margin: 0 }}>Thank you, {v.referrer}, for working with {v.business}. Share a friend&apos;s or another business&apos;s details and we will take good care of them.</p>
            </div>
            <Form token={token} business={v.business} />
          </>
        )}
        <p className="tiny faint" style={{ margin: 0 }}>Sent with Dhandha.</p>
      </div>
    </main>
  );
}
