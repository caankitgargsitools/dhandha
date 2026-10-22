# Dhandha — pending items

Checked and sent to the owner every morning (09:23 IST) by the Dhandha development session. Items move to
"Done" when the session can see them done (database, GitHub, live checks) or the owner says so.
Last checked: 22 Oct 2026.

## Waiting on you (only you can do these)

| # | Item | Why it needs you | How to tell me it's done |
|---|------|------------------|--------------------------|
| 1 | **Indian server (Oracle Mumbai VM)** | Needs your Oracle account. Unlocks GeM tenders, faster document fetching, a proper home for the always-on fetcher. | Say "server ready" — I'll check it reports in. |
| 2 | **Open Settings → Phone app once, install the app, turn on notifications** | Your first visit creates the notification keys and saves the site address (needs you signed in as platform admin). | I can see it in the database. |
| 3 | **Tell me the production web address** (or buy a domain, e.g. dhandha.in) | Vercel does not show me the project. | Paste the link. |
| 4 | **Gemini API key** (`GEMINI_API_KEY` in Vercel, free tier) | Makes tender reading free; today it uses paid Claude Haiku (99 credits a read). Needs your Google account. | I'll see reads by "gemini-free". |
| 5 | **Google Maps key** (`GOOGLE_MAPS_API_KEY` in Vercel; enable Places API (New) with billing) | Your Google Cloud billing account. | Search works on Generate leads → Google Maps. |
| 6 | **Apollo API key** (paste in Generate leads → Apollo) | Your Apollo account / plan with API access. | I can see it connected. |
| 7 | **Razorpay switch-on** (keys in Vercel, webhook in Razorpay, secret in Supabase Vault, seller GSTIN in Admin → Billing) | Your Razorpay account and KYC. | I can see the webhook secret and GSTIN. |
| 8 | **Email sending (Resend)**: account, `RESEND_API_KEY` and `OUTREACH_FROM_EMAIL` in Vercel, verify your domain | Your domain's DNS. | Outreach emails go out. |
| 9 | **Facebook / Instagram (Meta app)**: Business app, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` in Vercel, app secret in Vault, App Review | Meta requires the business owner. | I can see the app secret in Vault. |
| 10 | **Google Drive**: OAuth client (Web), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel | Your Google Cloud account. | Drive connect button works. |
| 11 | **MCA new companies**: upload this month's file at Admin → New companies | MCA's site blocks automated downloads. | I see new rows (last upload 17 Oct). |
| 12 | **Supabase: turn on leaked-password protection** (Authentication → Policies) | A dashboard switch my tools cannot reach. | Supabase security check clears. |
| 13 | **Make the crawler image public on GitHub** (Packages → dhandha-crawler → visibility) | Needs your GitHub login. Only matters for the Indian server. | The server pulls the image. |
| 14 | **Try the DFO Nuh tender in the assistant** (brief approved — continue: formats, questions, price, bid file) | Your answers and price. | I see the bid file made. |
| 15 | **Decide Phase 4 video style**: template videos / talking avatar / both | Your call. | Tell me A, B or both. |
| 16 | **Older Dhandha session "Ponytail GitHub installation"** is waiting for a reply from you | Started by you earlier. | Reply there, or tell me to close it. |

## I'm doing (no action from you)

| # | Item | Status |
|---|------|--------|
| A | Tender winners: results pages return nothing after the captcha — find the new layout and fix | Next |
| B | Cost planner: read the portal's BOQ Excel (.xls) into the items list | Planned |
| C | Fetched-document chunks: clear them from the database once stored | Planned |
| D | More tender detail pages per run (value, EMD) and a Haryana re-test | Planned |
| E | GeM tenders and winners — after the Indian server | Waiting on #1 |
| F | Desktop helper for DSC-assisted submission | Planned |
| G | AI calling (Phase 3) | Planned |
| H | Social posts and AI video (Phase 4) | Waiting on #15 |
| I | Play Store version of the phone app | When you want it |
| J | Before launch: remove demo data (152 rows), move pg_net out of the public schema | At launch |

## Done (recent)

- Tender assistant: fetch from portal with captcha in chat, brief, format picker, master questions, cost planner, bid file.
- Crawler reads every active GePNIC tender (12,700+ open); always-on document fetcher; pages run in Mumbai.
- Phone app with notifications; menus: Source new business (Tenders / Generate leads), Business Vault.
- Lead sources: tender winners, MCA, Facebook & Instagram, LinkedIn, Google Maps, Apollo, Excel/CSV.
