import test from "node:test";
import assert from "node:assert/strict";
import { isLinkedInExport, leadsFromLinkedIn, leadFromMetaFields } from "../lib/social.js";
import { parseCsv } from "../lib/leads.js";

const LI = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ravi,Kumar,https://www.linkedin.com/in/ravik,,Acme Builders Pvt Ltd,Director,12 Mar 2024
Neha,Jain,https://www.linkedin.com/in/nehajain,Neha@Sunrise.example,,Founder,01 Jan 2025
Bad,Row,https://example.com/x,,X,Y,Z
`;

test("reads LinkedIn's Connections.csv", () => {
  const rows = parseCsv(LI);
  assert.equal(isLinkedInExport(rows), true);
  const { leads, skipped } = leadsFromLinkedIn(rows);
  assert.equal(skipped, 1);
  assert.deepEqual(leads[0], { name: "Acme Builders Pvt Ltd", contact_person: "Ravi Kumar", linkedin_url: "https://www.linkedin.com/in/ravik", email: null, notes: "Position: Director\nLinkedIn connection since 12 Mar 2024" });
  assert.equal(leads[1].name, "Neha Jain");
  assert.equal(leads[1].email, "neha@sunrise.example");
  assert.equal(isLinkedInExport(parseCsv("Name,Phone\nA,1")), false);
});

test("maps Meta lead form fields", () => {
  const l = leadFromMetaFields([
    { name: "full_name", values: ["Neha Jain"] }, { name: "email", values: ["Neha@Sunrise.example"] },
    { name: "phone_number", values: ["+919811122334"] }, { name: "city", values: ["Gurugram"] },
    { name: "company_name", values: ["Sunrise Traders"] }, { name: "job_title", values: ["Owner"] },
    { name: "annual_turnover", values: ["1-5 crore"] },
  ]);
  assert.deepEqual(l, { name: "Sunrise Traders", contact_person: "Neha Jain", email: "neha@sunrise.example", phone: "+919811122334", city: "Gurugram", state: null, industry: null, notes: "Job title: Owner\nannual turnover: 1-5 crore" });
  assert.equal(leadFromMetaFields([{ name: "first_name", values: ["Ravi"] }, { name: "last_name", values: ["K"] }]).name, "Ravi K");
});
