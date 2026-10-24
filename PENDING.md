# Dhandha — pending items

Checked and sent to the owner every morning (09:23 IST) by the Dhandha development session. Items move to
"Done" when the session can see them done (database, GitHub, live checks) or the owner says so.
Last checked: 24 Oct 2026.

## Waiting on you (only you can do these)

| # | Item | Why it needs you | How to tell me it's done |
|---|------|------------------|--------------------------|
| 1 | **Indian server (Oracle Mumbai VM)** | Needs your Oracle account. Unlocks GeM tenders, faster document fetching, a proper home for the always-on fetcher. | Say "server ready" — I'll check it reports in. |
| 2 | **Open Settings → Phone app once, install the app, turn on notifications** | Your first visit creates the notification keys and saves the site address (needs you signed in as platform admin). | I can see it in the database. |
| 6 | **Apollo API key** (paste in Generate leads → Apollo) | Your Apollo account / plan with API access. | I can see it connected. |
| 7 | **Razorpay switch-on** (keys in Vercel, webhook in Razorpay, secret in Supabase Vault, seller GSTIN in Admin → Billing) | Your Razorpay account and KYC. | I can see the webhook secret and GSTIN. |
| 8 | **Email sending (Resend)**: account, `RESEND_API_KEY` and `OUTREACH_FROM_EMAIL` in Vercel, verify your domain | Your domain's DNS. | Outreach emails go out. |
| 9 | **Facebook / Instagram (Meta app)**: Business app, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` in Vercel, app secret in Vault, App Review | Meta requires the business owner. | I can see the app secret in Vault. |
| 10 | **Google Drive**: OAuth client (Web), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel | Your Google Cloud account. | Drive connect button works. |
| 11 | **MCA new companies**: upload this month's file at Admin → New companies | MCA's site blocks automated downloads. | I see new rows (last upload 17 Oct). |
| 12 | **Supabase: turn on leaked-password protection** (Authentication → Policies) | A dashboard switch my tools cannot reach. | Supabase security check clears. |
| 13 | **Make the crawler image public on GitHub** (Packages → dhandha-crawler → visibility) | Needs your GitHub login. Only matters for the Indian server. | The server pulls the image. |
| 15 | **Decide Phase 4 video style**: template videos / talking avatar / both | Your call. | Tell me A, B or both. |
| 16 | **Older Dhandha session "Ponytail GitHub installation"** is waiting for a reply from you | Started by you earlier. | Reply there, or tell me to close it. |
| 17 | **Upload your first database** at Admin → Data marketplace (CSV/Excel), declare its source, set a price, Go live | Only you know where the data comes from and that it is lawful (business data, or consumers who consented). | I see a live database. |
| 18 | **Say when to add the AI tender check** (AI reads each candidate tender's scope and keeps only work you can do; about ₹0.10 a tender, paid AI) | Your call on the cost. | Tell me "add the AI check". |

## I'm doing (no action from you)

| # | Item | Status |
|---|------|--------|
| A | Tender winners: results pages return nothing after the captcha — find the new layout and fix | Next |
| B | Cost planner: read the portal's BOQ Excel (.xls) into the items list | Planned |
| D | More tender detail pages per run (value, EMD) and a Haryana re-test | Planned |
| E | GeM tenders and winners — after the Indian server | Waiting on #1 |
| F | Desktop helper for DSC-assisted submission | Planned |
| G | AI calling (Phase 3) | Planned |
| L | Lead autopilot: one-click sourcing + scoring → WhatsApp/file sequence → AI call → pay link or booked meeting | Next |
| H | Social posts and AI video (Phase 4) | Waiting on #15 |
| I | Play Store version of the phone app | When you want it |
| J | Before launch: remove demo data (152 rows), move pg_net out of the public schema | At launch |
| K | AI tender check (scope of work, not just the title) | Waiting on #18 |

## Done (recent)

- 24 Oct: Sales team scheduling — salespeople with hours, work days and start point; meeting types (length + break); team calendar; "My day" route with Google travel times and directions; book from any lead or send the client a booking link.

- 24 Oct: Google Maps confirmed working (6 leads added); West Bengal and UP tenders read after the timeout fix; second free AI step (Gemini Flash-Lite) added because Gemini Flash was busy on every try.

- 23 Oct: Google Maps key added by the owner (Production + Preview) — Generate leads → Google Maps is on.

- 23 Oct: tender assistant — mandatory-condition warning with "File anyway", ask-anything box (Claude), technical marking with L1 best price / QCBS final score, annexures as editable forms with add-row.

- 23 Oct: customers never see captchas — they go to platform admins (desk + phone push); one portal session reused across tenders; shortlisted and strong matches fetched in advance.

- 23 Oct: fetched-document chunks are cleared automatically once the files are saved (13 MB freed).
- 22 Oct: DFO Nuh and J C Bose University draft bid files made; assistant shows filled formats, builds tables and partner details from Key people / Experience; AI fill and free Gemini reading fixed.

- Tender assistant: fetch from portal with captcha in chat, brief, format picker, master questions, cost planner, bid file.
- Crawler reads every active GePNIC tender (12,700+ open); always-on document fetcher; pages run in Mumbai.
- Phone app with notifications; menus: Source new business (Tenders / Generate leads), Business Vault.
- Live address found: https://dhandha-amber.vercel.app. Claude now has Vercel access; Gemini and Claude keys switched on for the live site and test copies.
- Precise tender search: strict keywords and blockers, "Matched on" with × to switch a word off; GSC went from 172 matches to 30 genuine CA tenders.
- Data marketplace: upload customer databases (CSV/Excel), customers filter and buy per record into Leads.
- Phone: wide tables (Leads etc.) now scroll sideways.
- Lead sources: tender winners, MCA, Facebook & Instagram, LinkedIn, Google Maps, Apollo, Excel/CSV.
