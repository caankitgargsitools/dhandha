# Dhandha — pending items

Checked and sent to the owner every morning (09:23 IST) by the Dhandha development session. Items move to
"Done" when the session can see them done (database, GitHub, live checks) or the owner says so.
Last checked: 28 Oct 2026.

## The queue — one by one, in this order

Steps 28–52 (added 28 Oct): what competitors have that we don't, and the tools that make Dhandha a complete "get more business" suite. The owner picks the order.

Who: **You** = only the owner can do it · **Claude** = I build it · **Both** = you decide or set up an account, then I build.
Old item numbers (#) are kept in brackets so earlier messages still make sense.

| Step | Item | Who | What "done" looks like | Status |
|------|------|-----|------------------------|--------|
| 1 | **AI tender check** — AI reads each candidate tender's scope and keeps only work you can do (cheapest AI first, about ₹0.10 a tender) (#18 / K) | Both | You said Yes (24 Oct); built and on for GSC | Done — runs hourly; the daily self-check shows it working |
| 2 | **Link Saurabh to his Dhandha login** — Sales team → Salespeople → Saurabh → pick his login → Save (#20) | You | Phone alerts and "My day" work for him | Done 24 Oct — Saurabh signed in (Manager) and his sales profile is linked |
| 3 | **Link your Google Business Profile** — Generate leads → Google Business Profile → search → "This is us" (#23) | You | I see the listing, score and checklist | Skipped for now (24 Oct) — ask again later |
| 4 | **Switch on the Lead autopilot** — daily budget, sources, Google Maps searches (#21) | You | I see it on and the first morning run | Done — first run 25 Oct 08:47: 18 leads (17 Google Maps, 1 tender winner) for ₹36; fixed so unused budget now goes to Google Maps (about 50 leads a day from 26 Oct) |
| 5 | **Phone app** — open Settings → Phone app once as platform admin, install, turn on notifications (#2) | You | Notification keys exist; a test alert reaches your phone | Done 24 Oct — Android phone registered; test alerts arrived |
| 6 | **Email sending (Resend)** — account, verify your domain, `RESEND_API_KEY` + `OUTREACH_FROM_EMAIL` in Vercel (#8) | You | The daily self-check shows email ready; review requests and sequences start emailing | Open |
| 7 | **Google Ads lead forms** — create the webhook key, paste URL + key into your lead form, "Send test data" (#22) | You | The test lead appears in Leads | Open |
| 8 | **MCA new-company files (last 6 months)** — on your Mac, run `bash <(curl -fsSL https://raw.githubusercontent.com/caankitgargsitools/dhandha/main/tools/mca-upload.sh)` (key "MCA Laptop 3" is saved there). 26 Oct: MCA's list found (folder 403: "Companies and LLPs registered in <month>", xlsx); the script now reads it directly — next run should load the files (#11) | Both | Six months of new companies in New companies leads | Paused on your instruction (26 Oct) — run again when you say |
| 9 | **Turn off Google Route Optimization API** in Google Cloud — it refuses API keys, so it only adds cost (#24) | You | Optional, no check needed | Open |
| 10 | **Supabase leaked-password protection** — Authentication → Policies (#12) | You | Supabase security check clears | Open |
| 10a | **Daily captcha session** — Admin → Captcha session → "Start today's session" each morning (reminder 09:31 IST), type each portal's captcha; re-verify a portal when its alert comes. Needs the phone app (step 5) for alerts | You | Portals show Live; tenders show "✓ Pre-checked" before anyone opens them; the page learns each portal's session length | From 25 Oct |
| 10b | **Big document hand-over time-outs** — 2 fetches on 24 Oct failed at `doc_job_put_chunk` (database statement time-out); make the chunk writes smaller/faster and retry (G) | Claude | No fetch fails at "Handing over" | Done 25 Oct — 512 KB pieces, no compression attempt, five retries |
| 11 | **Tender winners after the captcha** — results pages show nothing until their captcha is typed, and the crawler asked at times nobody was watching (all expired). 27 Oct: moved into the morning captcha session — after each portal goes live you get one more captcha "Tender winners: …" (A) | Both | Real award results arrive in Tender winners | Built 27 Oct; reached the server 27 Oct afternoon — first results at today's captcha session (28 Oct) |
| 12 | **More tender detail per crawl** (value, EMD) and a Haryana portal re-test (D) | Claude | Values / EMD filled on new tenders; Haryana tenders arrive | Done 28 Oct — matched tenders' detail pages (value, EMD) are opened first every crawl |
| 13 | **BOQ Excel (.xls) into the cost planner** (B) | Claude | Upload the portal's BOQ and its items fill the planner | Done 28 Oct — Import BOQ from Excel (.xls / .xlsx) in the cost planner, or use the BOQ from the tender documents |
| 14 | **Razorpay switch-on** — keys in Vercel, webhook in Razorpay, secret in Supabase Vault, seller GSTIN in Admin → Billing (#7) | You | Webhook secret + GSTIN present; a test top-up adds credits | Open |
| 15 | **Facebook / Instagram (Meta app)** — Business app, keys in Vercel, app secret in Vault, App Review (#9) | You | A test lead-ad lead arrives | Open |
| 16 | **Google Drive** — OAuth client (Web), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel (#10) | You | Drive connect button works | Open |
| 17 | **Apollo API key** — Generate leads → Apollo (#6) | You | Apollo connected | Open |
| 18 | **First database for the data marketplace** — upload, declare source and lawful basis, set a price, Go live (#17) | You | A live database | Open |
| 19 | **Indian server (Oracle Mumbai VM)** + make the crawler image public on GitHub (#1, #13) | You | The server reports in | Done 26 Oct — AWS Mumbai server (t4g.small) running the crawler, document fetcher and probes; GeM opens from India (42,206 ongoing bids) |
| 19a | **AWS budget alert** — Billing → Budgets → Create budget → monthly $20, alert to your email | You | A $20 alert exists (protects against surprise bills) | Open |
| 20 | **GeM tenders and winners** — runs on the Indian server (E) | Claude | GeM tenders and awards arrive | GeM tenders done 27 Oct (1,802 bids); GeM winners — being fixed (token done, results filter being checked) |
| 20a | **State portals (A)** — Gujarat ✅ (3,579 tenders); Karnataka needs its captcha → add to the morning session; AP / Telangana lists sit behind scripts (probing); Bihar resets our server's connection (retry at other hours) | Claude | Tenders from these states arrive | Gujarat done 27 Oct; rest in progress |
| 20b | **Large PSU portals (B)** then **IREPS (C)** | Claude | NTPC, ONGC, IOCL, BHEL, SAIL, Coal India…, then railway tenders arrive | After A |
| 20c | **Lead Playbook for new leads** — built 28 Oct (Win the business → Lead Playbook). Next for you: open it, press "Start from the ready-made playbook", adjust the steps (WhatsApp template names, scripts), switch it on. Who owns autopilot leads (round-robin to telecallers etc.) is still to decide, with AI calling | You | A playbook is on and new leads show "In progress" | Open |
| 21 | **AI calling** — our own **Dhandha AI** caller (free, self-hosted voices on the Mumbai server) is built for test calls from the browser: Lead Playbook → an AI-call step → "▶ Test this call". **Before calling the public:** a TRAI/DLT-registered telecom number (SIP trunk, e.g. Exotel/Plivo/Tata) to connect the caller to real phones; **before bulk calling:** a GPU server (the small server answers in a few seconds) | Both | You try a test call and tell me how it sounds; later you pick the telecom number | Test calls ready 28 Oct (once the server image updates) |
| 21a | **Call learning page** (Lead Playbook → Call learning, and Admin → Dhandha AI lessons) — line stats from real calls (lines that keep people talking, lines after which they hang up or interrupt, lines in calls that ended "interested"), transcripts with "Should have said…", lessons per playbook / company / all customers (shared ones approved by you), "Replay with lessons" to see the new answer before a real client hears it, and a **starter pack** of cold-calling lessons approved for everyone | Claude | You open a test call's transcript, teach a better line, replay it and hear the change on the next test call | Done 28 Oct — Lead Playbook → Call learning; Admin → Dhandha AI lessons (17 starter lessons) |
| 21b | **Dhandha AI fine-tuning** (after 21a, once real calls exist). Pointers: (1) **collect** — every call's transcript, outcome, who hung up, interruptions and lessons are kept; aim for 200–500 real calls per language before tuning; (2) **label** — on the call-learning page mark good calls / bad lines and write "should have said" answers (these become training pairs); (3) **evaluate first** — a fixed test set of 50 tricky situations (busy, price, "already have a CA", angry, Hindi switch, "are you a robot?") replayed after every change, scored for staying on call / meeting booked / politeness; (4) **tune cheaply first** — lessons and examples in the prompt (free, same day); then pick the best real calls as examples per industry; only at scale fine-tune a small open model (e.g. Llama / Qwen with LoRA) on our own GPU, keeping Claude as the fallback; (5) **ears and voice** — fine-tune Whisper on Indian-accent Hindi/Hinglish call audio (only with callers' consent, DPDP Act) and train our own Hindi/English Piper voices from a hired voice artist's recordings (written consent); (6) **privacy** — strip names, numbers and company details before any data is shared across customers or used for training; customers can opt out; (7) **A/B tests** — two opening lines or scripts per playbook, the winner kept automatically | Both | Measurably more calls end "interested" on the test set and in real calls | After 21a and real calls (needs the telecom number, step 21) |
| 21c | **Two-way WhatsApp team inbox** (competitor idea C1, approved 28 Oct) — clients' WhatsApp replies come into Dhandha (your WhatsApp number's webhook), matched to the lead (or a new lead), assigned to a team member, optional auto-reply (e.g. outside office hours), reply from Dhandha within WhatsApp's 24-hour window, a reply stops the playbook and moves the deal | Claude | A WhatsApp reply from a test number shows in Inbox and can be answered | Built 28 Oct and live — next for you: Outreach → Sender settings → Receive replies → paste the webhook address, verify token and app secret into your Meta app |
| 22 | **Social posts and AI video (Phase 4)** — choose the style: template videos / talking avatar / both (#15) | Both | You choose; I build | Waiting for your choice |
| 23 | **IndiaMART / JustDial buyer enquiries** — moved to step 40 | Both | — | See step 40 |
| 24 | **Desktop helper for DSC-assisted submission** (F) | Claude | Bid files submitted with your DSC from your computer | Planned |
| 25 | **Play Store version of the phone app** (I) | Claude | Listed on the Play Store | When you want it |
| 26 | **Older session "Ponytail GitHub installation"** is waiting for your reply (#16) | You | Reply there, or tell me to close it | Open |
| 27 | **Before launch** — remove demo data (`demo_seed`), move pg_net out of the public schema (J) | Claude | No demo rows; Supabase lint clean | At launch |
| 28 | **Price-to-win & rival tracking** — from award results: who won similar tenders, at what L1 price, win rates, which buyers favour whom; "bid ₹X to win" in the cost planner (TenderTiger TigerIQ, ₹500/rival) | Claude | Built and working | To do — one by one, in the order you choose |
| 29 | **Dhandha on WhatsApp** — search tenders by chat (Hindi/English), morning matches, approve bid steps, lead alerts (TenderTiger: ₹250/tender, ₹2,000/mo) | Both | Built and working | To do — one by one, in the order you choose |
| 30 | **Empanelment notices** — bank branch audits, C&AG / RBI panels, PSU vendor lists as a source (TenderTiger empanelment leads) | Claude | Built and working | Done 28 Oct — Tenders → Filter → Kind of notice: Empanelments & panels (also Rate contracts, EOI / RFP) |
| 31 | **Partner finder: consortium / JV and sub-contracting** — suggest partners from Dhandha users when eligibility is short; winners post sub-work (TenderTiger: ₹500/lead, ₹5,000/mo) | Claude | Built and working | To do — one by one, in the order you choose |
| 32 | **GeM done-for-you services** — GeM registration, catalogue upload, brand approval, vendor assessment as paid services | Both | Built and working | To do — one by one, in the order you choose |
| 33 | **Bid manager on demand** — marketplace of CA / consultant users who prepare bids for a fee; Dhandha takes a share (TenderTiger bid consultancy) | Both | Built and working | To do — one by one, in the order you choose |
| 34 | **Past tender results & BOQ library** — searchable results (L1, rates) and BOQs of closed tenders | Claude | Built and working | To do — one by one, in the order you choose |
| 35 | **Auction leads** — e-auction / reverse-auction notices as a source | Claude | Built and working | To do — one by one, in the order you choose |
| 36 | **Google Sheets sync and AI-assistant plug-in (MCP)** — live sheet of tenders/leads; connect Dhandha to ChatGPT / Claude / Gemini | Claude | Built and working | Sheets / Excel done 28 Oct — Account → Google Sheets & Excel (live link, =IMPORTDATA); AI-assistant plug-in (MCP) still to do |
| 37 | **Buyer side** — publish a tender/RFQ on Dhandha; private tenders; e-auction for buyers | Claude | Built and working | To do — one by one, in the order you choose |
| 38 | **Global tenders** (World Bank, ADB, other countries) | Claude | Built and working | To do — one by one, in the order you choose |
| 39 | **Simple website / landing page builder** with lead form, SEO basics | Claude | Built and working | To do — one by one, in the order you choose |
| 40 | **IndiaMART / JustDial / TradeIndia enquiries** flowing into Leads automatically (was step 23) | Both | Built and working | To do — one by one, in the order you choose |
| 41 | **WhatsApp chatbot for incoming enquiries** + **missed-call number** → Leads | Both | Built and working | To do — one by one, in the order you choose |
| 42 | **Google Business Profile: AI replies to reviews and posts updates** | Claude | Built and working | To do — one by one, in the order you choose |
| 43 | **Lead enrichment** — find missing emails / phones for leads | Claude | Built and working | To do — one by one, in the order you choose |
| 44 | **WhatsApp broadcasts** to opted-in lists | Claude | Built and working | To do — one by one, in the order you choose |
| 45 | **Exhibitions / trade-fair leads** | Claude | Built and working | To do — one by one, in the order you choose |
| 46 | **Quotation & proposal builder** on the letterhead with e-sign and a **payment link** (Razorpay); e-invoice when won | Claude | Built and working | To do — one by one, in the order you choose |
| 47 | **Referral programme, renewal reminders, win-back / upsell campaigns** | Claude | Built and working | Renewal reminders done 28 Oct — "Renews on" on a won deal → task + phone alert 30 and 7 days before; referral and win-back still to do |
| 48 | **Festival greetings & social posts with logo**, auto-posted to Google Profile / social (part of Phase 4, step 22) | Both | Built and working | To do — one by one, in the order you choose |
| 49 | **EMD / bank guarantee and working-capital finance** via bank / NBFC tie-ups (referral fee) | Both | Built and working | To do — one by one, in the order you choose |
| 50 | **Government schemes & subsidies finder** | Claude | Built and working | To do — one by one, in the order you choose |
| 51 | **Morning brief on WhatsApp** — today's tenders, follow-ups, hot leads, money due | Claude | Built and working | Done 28 Oct as a phone alert at 09:05 (new tenders, bids closing, follow-ups, tasks, meetings, new leads); on WhatsApp once Dhandha's WhatsApp is set up (step 29) |
| 52 | **Pricing of Dhandha** — set plans and credits against competitors (notes in CLAUDE.md "Competitors"); suggestion: free tier + ~₹999/mo or ₹9,999/yr all-in + credits | Both | Built and working | To do — one by one, in the order you choose |

## Done (recent)
- 28 Oct (night): **Dhandha AI voice caller** — our own, free: speech-to-text (Whisper), voices (Piper, Hindi/English, female/male), turn-taking with interruptions, the playbook script and replies in the client's language; it opens with "Namaste, I am Dhandha AI…". Test from the browser on any AI-call step.

- 28 Oct (night): small items cleared — morning brief on the phone, empanelment / rate-contract / EOI filter, live Google Sheets & Excel links, renewal reminders, value/EMD first for matched tenders, BOQ import, Bihar and 12 more portals (Indian Oil, Coal India, BHEL, NE states, Chandigarh, Puducherry, Ladakh).

- 28 Oct (evening): **Lead Playbook** built (Win the business → Lead Playbook): design what happens to every new lead — AI call, WhatsApp, email, booking link, tasks — in any order, any number of steps, with waits, only in your office hours; starts by itself on new leads (all or chosen sources) or for chosen leads. Tested end to end. Vault: Facts, Experience and Key people can now be edited.

- 28 Oct (audit): full self-audit of the portal (tenders, leads/CRM/sales, Vault/admin/billing/layout, crawler/workers) — about 110 findings; all high and medium ones fixed and merged, plus most low ones. Highlights: mandatory-condition warnings no longer block bid files for state preferences or unanswered questions; the database now enforces 2FA for admin powers; GitHub's duplicate crawler and document worker switched off (they split captcha sessions and caused database time-outs); document-expiry phone alerts now actually sent; autopilot survives a Google Maps time-out; no more duplicate deals; India time on all dates; Mark Submitted / Won / Lost on tenders; admin crawler page counts exact; Oracle text replaced with AWS.

- 28 Oct: Lead autopilot — 48 new leads for ₹96. 61 new tender matches for GSC in a day (50 from GeM, 8 Uttarakhand, 3 Gujarat). Fixed: the afternoon pre-fetch no longer queues tenders from portals whose documents we can't fetch yet (a Gujarat job failed). 6 pre-fetches failed yesterday afternoon because nobody typed the captcha (the server restart at 12:20 closed the morning sessions).

- 27 Oct (evening): server updater fixed (owner replaced Watchtower); GeM 6 → 1,802 bids (page's own data call with its real security token); Gujarat nProcure 3,394 → 3,579 tenders; Punjab / Rajasthan / West Bengal no longer lost to a database time-out (batch retry). 

- 27 Oct (later): Lead autopilot fixed — rerun found 50 new leads for ₹100 (skips businesses already in your leads, rotates searches). Tender winners now asked in the morning captcha session. Server updater (Watchtower) was broken since setup — replaced by the owner; the server now has all fixes and updates hourly. GeM reader verified on the live page (41,984 bids). Gujarat nProcure adapter built (≈3,400 tenders); Karnataka's search needs a captcha (will join the morning session); AP, Telangana, Bihar being probed. State portals (Gujarat, Karnataka, AP, Telangana, Bihar) open from India with no captcha; their tender lists load in the background, so probes now record those calls.

- 27 Oct: the Mumbai server crawled all 19 GePNIC portals overnight in 40 minutes (≈56,400 open tenders); 38 tenders pre-checked; 19 portal sessions live. GeM adapter now reads the bid list from the page (latest + service searches: audit, accountant, GST…). Lead autopilot found 0 new leads today — the same Google Maps results repeat; fix in progress (look past businesses already in your leads).

- 26 Oct: Lead autopilot 2nd run — 35 new leads for ₹70 (15 already in your leads skipped); 72 GSC leads in all. Crawl runs no longer cut off at 25 minutes (the old document step removed — the always-on worker does it). Haryana and Delhi tenders arriving.

- 25 Oct: Lead autopilot first run (18 leads in the CRM at New); unused budget now goes to Google Maps. Document hand-over time-outs fixed. 22 tenders pre-checked with "Get ready" lists; 6 portal sessions live (CPPP, Delhi, Maharashtra, MP, Odisha, Punjab).

- 24 Oct: assistant tabs (Tender summary, Documents) and saved chat; portal dates win over document dates; get-ready list; automatic pre-check; daily captcha session with per-portal learning; credit balance pill; phone notifications on; MCA monthly fetcher (MCA refuses GitHub's US machines — needs the Indian server or upload by hand).

- 24 Oct: strict tender matching — GSC 58 → 50 open matches, all with a CA word; 21 irrelevant ones hidden (IT/police PMUs, tech consultant, engineering DPRs, closed and demo leftovers) and 14 missed CA tenders added (techno-financial audits, financial consultant / transaction adviser on works projects, revenue-assurance and CBS audits, accounting outsourcing). Spend outside Dhandha in Results by source.

- 24 Oct: Lead autopilot (daily budget → leads a day, sources, morning run), automatic CRM stages (New → Messaged → Called → Link sent → Meeting → Won), Results by source, tender filters, route-aware salesperson matching + Plan visits, Google Ads lead forms → Leads, Google Business Profile check + automatic review requests to won customers, live self-check (Google Routes working).

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
