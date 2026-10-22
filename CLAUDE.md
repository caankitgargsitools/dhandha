# Dhandha — handover notes for Claude Code

Dhandha (धंधा) is a multi-tenant SaaS "one stop business generation suite" being built by CA Ankit Garg to sell to other businesses.

It covers:
- tenders: crawl, read, fill and file
- a document Vault, so users are never asked for the same document twice
- annexures printed on the customer's letterhead with their signature
- lead scraping
- a CRM
- social posts and AI video
- central ML shared across users
- billing: a small subscription plus pay-as-you-go credits

## Stack and hosting
- **Next.js 16** (App Router, plain JS). `proxy.js` replaces middleware. Server actions use `useActionState`.
- **Vercel** project `dhandha`, team `caa-nkit-garg-sit-ools`. Pushing to `main` deploys to production. Functions run in Mumbai (`vercel.json` regions `bom1`, next to the Supabase database); keep page queries parallel (`Promise.all`).
- **Supabase** project `umyesrpibsdgzsrqfvqf` (Mumbai, Pro plan).
  - Postgres with row-level security per tenant.
  - Auth with TOTP 2FA (AAL2 is required for `/app`).
  - Storage for files.
  - Client is `@supabase/ssr`; the URL and publishable key are in `lib/config.js`.
- **GitHub:** `caankitgargsitools/dhandha`.
- **Secrets** live only in Vercel Environment Variables (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and so on), never in code or chat.

## Ground rules from the owner
1. **Cost order is always free → cheaper → costlier.**
   - Tender reading: the free rule engine first (`lib/tenderRules.js`), then Gemini free tier, then Claude Haiku, then Claude Sonnet. See `lib/ai.js`.
   - The Gemini free tier may train on what it receives, so it only ever gets public tender documents (`private:false`). Customer private data goes to paid tiers only (`private:true`).
2. **Own crawler only.** No aggregator or third-party tender data services. Code is in `crawler/` (Node + Playwright; GePNIC and GeM adapters). Never bypass or auto-solve captchas: where a page needs one, the crawler shows the picture to a platform admin (Admin → "Captcha needed" card, `crawler/src/captcha.js`, `crawler_captchas`) and a person types it.
3. **Signatures need the admin's TOTP code.** Signature and seal go on a PDF only after the admin enters it, and every use is logged (`log_signature_use`). Drafts carry a "DRAFT – NOT SIGNED" watermark.
4. **No credentials in chat.** Never ask for passwords or keys.
5. **Prefer non-destructive database changes.** Disable roles, revoke flags or ban users instead of deleting rows.
6. **Dummy data must be removable.** Every demo row is registered in `public.demo_seed(table_name,row_id)` so it can be removed before go-live.
8. **Pending list, every day.** `PENDING.md` lists what waits on the owner and what Claude is doing. Do everything possible yourself; list only what truly needs the owner. A scheduled task checks it every morning (09:23 IST): verify what is done (database, GitHub, live checks), finish what you can, update the file, and send the list to the owner in chat, asking them to say what they have done. Follow this in all development.
7. **Answer in chat.** The owner wants answers inline in chat rather than as separate documents. Ask questions one at a time, with Yes/No/Skip or multiple-choice options.

## Map of the code
- `lib/session.js`: `getContext()` (user, tenant, role, company switcher, 2FA check). `lib/admin.js` holds the platform-admin context.
- Source new business: a menu item with a submenu (SideNav `children`, opens on hover or tap): Tenders and Generate leads. `/app/source` shows both as cards; `/app/leads/generate` holds every lead source as a card (Your leads, Tender winners, New companies, Facebook & Instagram, LinkedIn `/app/leads/linkedin`, Google Maps `/app/leads/google-maps`, Apollo `/app/leads/apollo`, Import a list) — new sources go there.
  - Google Maps (`lib/connectors.js` `placesSearch`/`mapPlace`, tested): Places API (New) Text Search with Dhandha's `GOOGLE_MAPS_API_KEY` (Vercel; owner switch-on); 2 credits (`lead_found`) per lead added. Apollo: each workspace admin connects their own Apollo API key (`set_apollo_key` → Vault, `lead_connectors`); people search via `apolloSearch`/`mapApolloPerson`; free in Dhandha. Ticked results → `addFoundLeads` → `import_leads` (sources `google_maps`, `apollo`). Lead pages share `components/SourceTabs.js`. "Win the business" group: CRM pipeline, Outreach.
- Business Vault: one menu item → `/app/vault` (cards with completeness); its pages (What we do, Company profile, Documents, Facts, Experience, Key people, Letterhead & signature) share a tab strip (`components/VaultTabs.js` via `layout.js` in each folder). SideNav items take `match` / `exclude` path lists for highlighting.
- `lib/taxonomy.js`: 10 industries → 29 sub-industries → 65 services, mapped to keywords and industry pack. Used by "What we do" at `/app/tenders/preferences`.
- Tender engine:
  - `lib/bidpack.js`: PDF bid pack on the letterhead.
  - `lib/pdftext.js` and `lib/tenderRules.js`: free reading.
  - `lib/tenderAi.js`: AI reading.
  - `lib/formatLibrary.js` and `lib/formatAi.js`: tender format filling.
  - Gap questions save their answers to `company_facts`.
  - Tender assistant (`app/app/tenders/[id]/assistant/*`): a chat that walks a tender from fetch → read → brief → (you approve) → questions → formats → bid file, one question at a time; answers go to the Vault (`questionActions.js`).
    - Fetch (`DocFetch.js`, `docActions.js`): opening the assistant queues a `tender_doc_jobs` row (`request_tender_docs`); an always-on worker (`.github/workflows/tender-docs.yml`: ~6-hour runs, hourly schedule keeps the next one queued; free because the repository is public) claims it within seconds. The scheduled crawl also picks up queued jobs. A permanent Indian server is the long-term home for this worker. `crawler/src/docs.js` finds the tender (organisation list → organisation → tender), reads the detail page, downloads "Download as zip file" (or each document) — the portal's captcha picture is shown in the chat and the person types it (`answer_doc_captcha`) — and hands files back in chunks (`doc_job_put_chunk` → `tender_doc_chunks`). `collectDocs` stores them in Storage as the user, then the documents are read (AI when configured).
    - After the brief is approved: yes/no conditions → format picker (`FormatPicker` in `Questions.js`; `candidates()` / `CHOICES` in `lib/formatLibrary.js`: best template pre-selected, or the tender's own wording filled by paid AI, or "fill myself"; `chooseFormats`) → master questions (`lib/masters.js`, tested: `NEEDS` per format, `missingMasters`, one question at a time, saved to the company record / Facts / works / people by `masterActions.js`; AI placeholders `[TO BE FILLED: x]` become `master.*` facts, matched by wording and filled into the bid file by `fillPlaceholders`) → price → bid file. Nothing but the price is asked per tender.
    - Price (`CostPlanner.js`, `lib/costing.js`, tested): type the quote, or work it out — BOQ items, manpower with PF/ESI/bonus, travel and stay, other costs, overheads, contingency, margin slider, GST, vs the estimate. Stored on `tender_matches` (`cost_sheet`, `quoted_price`, `price_note`), shown on the preparation sheet.
    - Brief (`TenderBrief.js`): numbers, dates, the work, do-not-miss points, eligibility against the Vault, documents to submit, formats, clauses to watch. "Looks good — start preparing" sets the match to preparing; only then does the assistant ask questions.
    - Bid file: drafts open with an internal "Bid preparation sheet" (brief + before-the-deadline steps) ahead of the covering letter, formats and checklist (`lib/bidpack.js`).
  - Eligibility conditions (`lib/conditions.js`, tested): branch/office in a state, GST in a state, ISO, contractor class, years in business — found free in the tender text (plus the AI reader's other_eligibility lines), stored in `tenders.conditions` via `set_tender_conditions`. Answers are yes/no facts (`presence.office.bihar` etc., period ''). `score_tender`: yes = met, no = not eligible, unanswered = pending (`tender_matches.pending`, chip "Qualifies if you answer N", score capped at 60) — missing turnover or no recorded works are pending too, never a rejection. Open questions show on the Tenders page (`QuestionCards.js`).
- Tender pages: `app/app/tenders/*`. Actions are in `bidActions.js`, `readActions.js`, `formatActions.js`.
- Leads and CRM: `lib/leads.js` (CSV import, phone clean-up, free fit score, WhatsApp/tel links; tested in `tests/leads.test.mjs`).
  - Pages: `app/app/leads/*`, `app/app/crm/*`. Actions in `leads/actions.js` and `crm/actions.js`. Timeline and log form in `components/CrmTimeline.js`.
  - Tender winners (`/app/leads/winners`): award results from our crawler (`crawler/src/adapters/gepnicResults.js` and `gemResults.js` → `ingest_awards` → `tender_awards`), filtered per company by `winner_prospects`. Adding a winner as a lead costs `lead_found` credits.
  - New companies (`/app/leads/new-companies`): MCA's monthly registrations, uploaded by the platform admin at Admin → New companies (`lib/mca.js` parses .xlsx/.csv; `lib/xlsx.js` is a dependency-free Excel reader, also used by lead import). Filtered per company by `mca_prospects`; adding costs `lead_found` credits.
  - Social (`lib/social.js`, permitted routes only — no scraping of LinkedIn/Facebook/Instagram):
    - LinkedIn: the user's own Connections.csv export, recognised automatically by Leads → Import (free, matched on profile URL).
    - Facebook/Instagram Lead Ads (`lib/meta.js`, `/api/meta/start|callback|webhook|run`, `/app/settings/facebook`): admin connects Pages; Meta's webhook → `meta_webhook` (signature checked in SQL) → worker fetches the lead → Leads with a timeline note.
  - Click-to-call / click-to-WhatsApp from the user's own phone. DND leads hide the buttons.
- Outreach (`app/app/outreach/*`, `lib/outreach.js`): email + WhatsApp sequences and one-off sends, paid in credits (`email_send`, `whatsapp_send`).
  - Email: Dhandha's Resend account (`RESEND_API_KEY`, `OUTREACH_FROM_EMAIL` in Vercel), sender name and reply-to per workspace, unsubscribe page `/u/[token]` + one-click `/api/unsubscribe`.
  - WhatsApp: each workspace's own Cloud API number and approved templates ({{1}} = first name, {{2}} = company); token kept in Vault; only to leads with `wa_opt_in`.
  - Worker: pg_cron → pg_net → `POST /api/outreach/run` with the Vault worker key; the route claims, sends, reports. Logging a real conversation stops sequences.
- Billing (Razorpay): `lib/billing.js` (GST quote, amount in words; tested), `lib/razorpay.js` (Orders API), `app/app/wallet/*` (top-up, plan, invoices), `components/BillingForms.js` + `PayButton.js`, webhook at `app/api/razorpay/webhook/route.js`.
  - Credits are added only by the signed webhook. The HMAC is checked in SQL (`razorpay_webhook`) against the Vault secret `razorpay_webhook_secret`; the route just passes the raw body through.
  - Plans are prepaid 30-day periods (no auto-debit mandate yet). Only the workspace admin can pay.
- Google Drive (`lib/google.js`, `lib/drive.js`, `/api/google/start|callback`, `/app/settings/drive`, `components/DriveUpload.js`): one Drive per workspace, `drive.file` scope only, refresh token AES-GCM encrypted with a key derived from `GOOGLE_CLIENT_SECRET`. Vault document uploads go browser → Google (resumable session) into "Dhandha – <workspace>/<company>"; pasted Drive links still work.
- Phone app (installable web app): `app/manifest.js`, `public/sw.js` (offline page, notifications, tap opens the page), icons in `public/icons`, `components/PwaRegister.js`, Settings → Phone app (`app/app/settings/app/*`: install button, notifications per device, test).
  - Notifications: `push_subscriptions` per device, `push_queue` per person; `/api/push/run` (woken by `worker_kick`, worker key) sends with `web-push`. VAPID keys are made on first visit by a platform admin (`push_init_keys`; private half in Vault as `vapid_private`); that visit also saves the site address if unset.
  - Events: captcha needed (platform admins), document fetch needs a captcha / fetched / failed (the person who asked), new matching tenders (hourly digest, `push_tender_digest`), follow-ups due (09:05 IST, `push_followups`).
- Admin panel: `app/admin/*`. Covers tenants, people, credits, tickets, pricing, billing (seller GSTIN, switch-on checklist, payments, webhook log), audit, crawler keys and AI spend.
- Database logic lives mostly in SQL. The migrations list is in `supabase/README.md`.
  - Key functions: `score_tender` (CPWD norms), `tender_fits`, `kw_rx` (whole-word matching, plurals allowed), `allowed_packs`, `rescore_company`, `ingest_tenders`, `spend_credits`, `add_team_member`, `claim_invites`, `import_leads`, `escalate_overdue_deals` (pg_cron, hourly), `sees_all_leads`.
- Roles: admin, manager, bid_preparer, telecaller, field, viewer, disabled.
- Design system ("bahi-khata" ledger look):
  - Colours: madder #8c1d2f, marigold #f0a202, ink #1b2240.
  - Fonts: Bricolage Grotesque, Manrope, Tiro Devanagari Hindi.
  - Charts are hand-drawn SVG in `components/Charts.js`.
- Tests: `node --test tests/` and `cd crawler && npm test`.

## Done so far
- **Phase 0:** auth, tenants, credits, admin, tickets, tasks, team invites.
- **Phase 1:** tender engine.
  - Preferences, eligibility scoring, the crawler intake (`ingest_tenders`), reading, format filling, the gap window and bid packs.
- Industry and services picker.
- **Phase 3, part 1:** working Leads and CRM.
  - Add a lead or import a CSV, with duplicate checks and an ideal-client score.
  - Owners and follow-ups; telecallers see only their own leads.
  - Call/WhatsApp/email links, an activity timeline, a deal pipeline with stage moves, and escalation of overdue steps to a manager.
- **Billing:** Razorpay checkout for credit top-ups and 30-day plans, verified webhook, GST invoices.
- **Social leads:** LinkedIn connections import; Facebook/Instagram Lead Ads arrive in Leads automatically. Crawler deploy: published image + one-paste Oracle setup.
- **Google Drive:** per-workspace connection; Vault uploads go straight into the customer's Drive.
- **Phase 3, part 5:** GeM award results (L1/awarded seller) feed tender-winner leads too.
- **Phase 3, part 4:** paid outreach — email/WhatsApp sequences, one-off sends, unsubscribe, credits.
- **Phase 3, part 3:** new-company leads from MCA registration data; Excel (.xlsx) lead import.
- **Phase 3, part 2:** tender-winner leads from GePNIC award results. When a Dhandha company itself wins, its tender match is marked won.

## Still to do
- Google Maps switch-on: owner enables Places API (New) in a Google Cloud project with billing, creates an API key (restrict to Places API), adds `GOOGLE_MAPS_API_KEY` in Vercel.
- Desktop helper for DSC-assisted submission.
- Crawler runs on GitHub Actions (`.github/workflows/crawler-run.yml`, 3×/day + Run workflow; secret `INGEST_KEY`; 17-min budget, 3 portals at a time, portals rotate). Live progress: crawler → `crawler_progress` → `crawler_live` / `crawler_step_stats` → Admin → Crawler "Live crawler" window (`app/admin/crawler/LiveCrawler.js`, estimates in `lib/crawlerEta.js`). If some state portals refuse GitHub's US machines, move them to an Indian server.
- Optional Indian server: Admin → Crawler → Create key shows a cloud-init script; paste it into a new Oracle Always Free Ubuntu VM (Mumbai). The image is published to GHCR by `.github/workflows/crawler-image.yml` (make the package public once).
- Tender winners: verify the GePNIC and GeM results adapters against the live portals on the first crawler run (both were written without network access to them; GeM's listing filter is `GEM_RESULT_STATUS`).
- Phase 3, rest:
  - AI calling.
- Phase 4: social content and AI video.
- Facebook/Instagram switch-on: owner creates a Meta app (Business type, Facebook Login for Business + Webhooks), adds `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` in Vercel and the app secret in Supabase Vault as `meta_app_secret`; webhook URL `https://<domain>/api/meta/webhook` (Page → leadgen); App Review for leads_retrieval and page permissions.
- Google Drive switch-on: owner creates a Google Cloud OAuth client (Web; redirect `https://<domain>/api/google/callback`; consent screen with the `drive.file` scope) and adds `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel. Later: save signed bid packs to Drive too.
- Razorpay: switch on (owner adds keys in Vercel, webhook in Razorpay, secret in Supabase Vault, seller GSTIN in Admin → Billing). Later: auto-renewing subscriptions (Razorpay mandates), credit notes/refunds.
- Outreach switch-on: Admin → Outreach site address; Resend account + `RESEND_API_KEY` / `OUTREACH_FROM_EMAIL` in Vercel. Later: delivery/bounce webhooks, inbound reply detection.
- MCA: the owner uploads each month's file at Admin → New companies (MCA's portal sits behind bot protection; no captcha is bypassed). An automated feed can post to `ingest_mca` later.
- Before launch:
  - Remove dummy data using `demo_seed`.
  - Enable leaked-password protection in Supabase.
  - Optional tidy-up: move `pg_net` out of the `public` schema (Supabase lint WARN; needs a drop/re-create of the extension).
