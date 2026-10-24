"use client";
import { useState } from "react";
import BookMeeting from "./BookMeeting";

// Sales team page: pick a lead, then the same booking panel as on the lead page.
export default function BookForLead({ leads, types, business }) {
  const [id, setId] = useState("");
  const lead = leads.find((l) => l.id === id);
  return (
    <div className="stack-sm">
      <div><label htmlFor="bfl">Who is the meeting with?</label>
        <select id="bfl" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">— pick a lead —</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.contact_person ? ` · ${l.contact_person}` : ""}{l.city ? ` · ${l.city}` : ""}</option>)}
        </select></div>
      {!leads.length && <p className="small muted" style={{ margin: 0 }}>No leads yet — add one under Source new business → Generate leads.</p>}
      {lead && <BookMeeting key={lead.id} leadId={lead.id} types={types} address={lead.address} phone={lead.phone} contact={lead.contact_person} business={business} />}
    </div>
  );
}
