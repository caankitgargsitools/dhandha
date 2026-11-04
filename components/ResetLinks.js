import InviteShare from "./InviteShare";

// Password resets people asked for (no mail sender yet): the admin copies the one-time link and sends it to them.
export default function ResetLinks({ rows, origin }) {
  if (!rows?.length || !origin) return null;
  return (
    <div className="panel stack-sm">
      <h3 style={{ margin: 0 }}>Password resets asked for</h3>
      <p className="tiny faint" style={{ margin: 0 }}>Send each person their own link (WhatsApp or chat). It works once, for 24 hours. Never send it to anyone else.</p>
      {rows.map((r) => (
        <div key={r.token} className="row between" style={{ gap: 8 }}>
          <div className="small"><strong>{r.full_name}</strong> <span className="faint">{r.email}</span></div>
          <InviteShare url={`${origin}/reset/${r.token}`} name={r.full_name} text={`Hi ${String(r.full_name || "").split(" ")[0]}, here is your link to set a new Dhandha password (works once, 24 hours): ${origin}/reset/${r.token}`} />
        </div>
      ))}
    </div>
  );
}
