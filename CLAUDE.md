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
- **Vercel** project `dhandha` (`prj_YMLMeRl750pZN5i30myZ89BVuGch`), team `caa-nkit-garg-sit-ools`; live at https://dhandha-amber.vercel.app. Env vars must be ticked for Production and Preview. Pushing to `main` deploys to production. Functions run in Mumbai (`vercel.json` regions `bom1`, next to the Supabase database); keep page queries parallel (`Promise.all`).
- **Supabase** project `umyesrpibsdgzsrqfvqf` (Mumbai, Pro plan).
  - Postgres with row-level security per tenant.
  - Auth with TOTP 2FA (AAL2 is required for `/app`).
  - Storage for files.
  - Client is `@supabase/ssr`; the URL and publishable key are in `lib/config.js`.
- **GitHub:** `caankitgargsitools/dhandha`.
- **Secrets** live only in Vercel Environment Variables (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and so on), never in code or chat.

## Ground rules from the owner
1. **Cost order is always free → cheaper → costlier — for every AI or paid tool, in every project.** Where several tiers exist, layer them: a free tool or reader first (rules engine, Gemini free tier, …); only if it cannot do the job, the cheapest paid one; then costlier ones. Never start at a paid tier when a free one can try.
   - Tender reading: the free rule engine first (`lib/tenderRules.js`), then Gemini free tier, then Claude Haiku 5.5, then Haiku 4.5, then Claude Sonnet 5.5 (`lib/ai.js` `aiTiers`; each failure, refusal or cut-off answer falls through to the next; spend per call in `ai_usage`).
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
- Source new business: a menu item with a submenu (SideNav `children`, opens on hover or tap): Tenders and Generate leads. `/app/source` shows both as cards; `/app/leads/generate` holds every lead source as a card (Your leads, Tender winners, New companies, Facebook & Instagram, LinkedIn `/app/leads/linkedin`, Google Maps `/app/leads/google-maps`, Apollo `/app/leads/apollo`, Buy data `/app/leads/databases`, Import a list) — new sources go there.
  - Google Maps (`lib/connectors.js` `placesSearch`/`mapPlace`, tested): Places API (New) Text Search with Dhandha's `GOOGLE_MAPS_API_KEY` (Vercel; owner switch-on); 2 credits (`lead_found`) per lead added. Apollo: each workspace admin connects their own Apollo API key (`set_apollo_key` → Vault, `lead_connectors`); people search via `apolloSearch`/`mapApolloPerson`; free in Dhandha. Ticked results → `addFoundLeads` → `import_leads` (sources `google_maps`, `apollo`). Lead pages share `components/SourceTabs.js`. "Win the business" group: CRM pipeline, Outreach.
- Business Vault: one menu item → `/app/vault` (cards with completeness); its pages (What we do, Company profile, Documents, Facts, Experience, Key people, Letterhead & signature) share a tab strip (`components/VaultTabs.js` via `layout.js` in each folder). SideNav items take `match` / `exclude` path lists for highlighting. The menu is a drawer hidden by default (`components/SideNav.js`): the ☰ `MenuButton` at the top right of both top bars opens it; a choice, Esc or a tap outside closes it; pages use the full width.
- `lib/taxonomy.js`: 11 industries → 30 sub-industries → 67 services, mapped to keywords and industry pack. Used by "What we do" at `/app/tenders/preferences`.
  - Precise matching (tested in `tests/taxonomy.test.mjs`): a keyword is `"phrase"` or `"word + context|context"` (a context stem must also be in the title) with optional `" - blocker|blocker"`; words in capitals (TDS, PMC) must appear in capitals; the "(Ref …)" tail of a title is ignored; `PACK_NOT` (DB `tender_pack_not`) blocks works/supply/non-financial-audit titles for the CA pack. `rulesFor()` → `tender_preferences.rules`; SQL `tender_match_words` mirrors `ruleHits()` — keep them in step. Engineering DPR/PMC/TPI sit in "Engineering consultancy", not CA.
  - Each match stores `matched_on`; the Tenders page shows it with × (`muteTenderWord` → `mute_tender_word`, `tender_preferences.muted`). `rescore_company` prefilters with one regex, then runs the rules; matches that stop fitting get `unfit` (hidden, not deleted).
- Tender engine:
  - `lib/bidpack.js`: PDF bid pack on the letterhead.
  - `lib/pdftext.js` and `lib/tenderRules.js`: free reading.
  - `lib/tenderAi.js`: AI reading.
  - `lib/formatLibrary.js` and `lib/formatAi.js`: tender format filling.
  - Gap questions save their answers to `company_facts`.
  - Tender assistant (`app/app/tenders/[id]/assistant/*`): a chat that walks a tender from fetch → read → brief → (you approve) → questions → formats → bid file, one question at a time; answers go to the Vault (`questionActions.js`).
    - Fetch (`DocFetch.js`, `docActions.js`): opening the assistant queues a `tender_doc_jobs` row (`request_tender_docs`); an always-on worker (`.github/workflows/tender-docs.yml`: ~6-hour runs, hourly schedule keeps the next one queued; free because the repository is public) claims it within seconds. The scheduled crawl also picks up queued jobs. A permanent Indian server is the long-term home for this worker. `crawler/src/docs.js` finds the tender (organisation list → organisation → tender), reads the detail page, downloads "Download as zip file" (or each document) — a portal captcha goes to Dhandha's platform admins only (captcha desk `app/admin/CaptchaDesk.js`, also on /app pages for them; `admin_doc_captchas`; phone push) and a person types it (`answer_doc_captcha`); customers just see the fetch progressing — the worker keeps one browser session per portal between jobs (`sessionFor`, 20-min idle) and claims user jobs first, then same-portal jobs (`doc_job_claim(key, runner, portal)`). Prefetch: shortlisted/preparing matches and new eligible matches scoring ≥70 queue an `auto` job (`tender_matches_prefetch` → `private.queue_prefetch`, ≤10 per company a day, GePNIC portals only); fetched-but-unopened prefetches expire after 3 days (cron `expire_doc_prefetches`). Opening the assistant collects an already-fetched job straight away — and hands files back in chunks (`doc_job_put_chunk` → `tender_doc_chunks`). `collectDocs` stores them in Storage as the user, then the documents are read (AI when configured).
    - After the brief is approved: yes/no conditions → format picker (`FormatPicker` in `Questions.js`; `candidates()` / `CHOICES` in `lib/formatLibrary.js`: best template pre-selected, or the tender's own wording filled by paid AI, or "fill myself"; `chooseFormats`) → master questions (`lib/masters.js`, tested: `NEEDS` per format, `missingMasters`, one question at a time, saved to the company record / Facts / works / people by `masterActions.js`; AI placeholders `[TO BE FILLED: x]` are sorted by `classifyBlanks`: partner details come from Key people marked Partner/Proprietor/Director (`partnerList`; `people.membership_no`, `pan`; asked via `setPersonField`) or a per-partner fact (`partnerFact`), "Complete table with …" is built from Key people / Experience, pages that are not forms (`isReference`, AI returns `[REFERENCE ONLY]`) are skipped and left out of the bid file, the rest become `master.*` facts; all filled by `fillPlaceholders`. The assistant shows "Your formats" with each filled text and its status) → price → bid file. Nothing but the price is asked per tender.
    - Price (`CostPlanner.js`, `lib/costing.js`, tested): type the quote, or work it out — BOQ items, manpower with PF/ESI/bonus, travel and stay, other costs, overheads, contingency, margin slider, GST, vs the estimate. Stored on `tender_matches` (`cost_sheet`, `quoted_price`, `price_note`), shown on the preparation sheet.
    - Brief (`TenderBrief.js`): numbers, dates, the work, do-not-miss points, eligibility against the Vault, documents to submit, formats, clauses to watch. "Looks good — start preparing" sets the match to preparing; only then does the assistant ask questions.
    - Mandatory conditions never silently reject: `mandatoryUnmet(reasons)` (`lib/conditions.js`, tested; preferences, time left and document renewals are reminders, not conditions) plus failed yes/no conditions stop the assistant at a warning step — "We do meet it" (answers yes / Vault), "File anyway" (`forceFiling` → `tender_matches.forced_at/by/note`, audit log) or "Not for us". `generateBidPack` refuses while unresolved. Tenders stay listed with a "⚠ Mandatory condition not met" chip.
    - Ask anything: a box at the bottom of the assistant → `askAssistant` (`app/app/tenders/assistantActions.js`): Claude (paid tiers, `private:true`) with the tender PDF (`lib/tenderPdf.js` `tenderPdfFor`), the brief, eligibility, evaluation, the Vault (`vaultFor`) and the question on screen; 3 credits (`assistant_chat`).
    - Technical marking: `techMarking` (29 credits, `tech_marking`) reads the evaluation method and criteria and marks the bidder from the Vault → `tender_matches.tech_eval` (`lib/evaluation.js`, tested: `normaliseEval`, `techTotals`, `qcbsScore`, `maxPriceToBeat`, `l1Advice`). `EvalPanel.js` at the price step: L1 → best price (cost + minimum margin vs estimate); QCBS → weighted final score vs a rival and the highest price that still wins.
    - Annexures as forms: each format in the tender's own wording (or "fill myself") opens as `AnnexureEditor.js` — `lib/annexure.js` (tested) `buildSegments` turns the text into text / fields (pre-filled from masters, yellow if missing) / tables (Key people, Experience; add rows, optionally saved to the Vault); `saveAnnexure` stores `edited_text` (tables as `⟦table cols⟧ rows ⟦/table⟧`), marks it `reviewed`, saves answers as facts / people fields. "Your formats" → "Open as a form" any time. The bid file prints `edited_text` with real tables (`parseBlocks`).
    - Bid file: drafts open with an internal "Bid preparation sheet" (brief + before-the-deadline steps) ahead of the covering letter, formats and checklist (`lib/bidpack.js`).
  - Eligibility conditions (`lib/conditions.js`, tested): branch/office in a state, GST in a state, ISO, contractor class, years in business — found free in the tender text (plus the AI reader's other_eligibility lines), stored in `tenders.conditions` via `set_tender_conditions`. Answers are yes/no facts (`presence.office.bihar` etc., period ''). `score_tender`: yes = met, no = not eligible, unanswered = pending (`tender_matches.pending`, chip "Qualifies if you answer N", score capped at 60) — missing turnover or no recorded works are pending too, never a rejection. Open questions show on the Tenders page (`QuestionCards.js`).
- Tender pages: `app/app/tenders/*`. Actions are in `bidActions.js`, `readActions.js`, `formatActions.js`.
- Data marketplace: the platform admin uploads contact databases (CSV/XLSX ≤50 MB, ≤100k rows) at Admin → Data marketplace (`app/admin/data/*`; bucket `datasets`). Each upload declares source and lawful basis (`public_business_info` for business data only; consumer data only with `consent` / `own_customers`, DPDP Act) — no leaked or scraped consumer lists. `lib/datasets.js` (tested) maps columns (name, company, role, industry, city, state, email, phone, LinkedIn, website; the rest go to `extra`) and builds filter facets. Customers search free at `/app/leads/databases/[id]` (`data_search`, contacts masked) and buy per record (`data_buy` / `data_buy_matching`, ≤500 at a time, price_book `data_record` × the set's `price_credits`) into Leads (source `database`). Opt-outs: `data_suppression` (`data_suppress`).
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
  - Working indicators (owner's rule: every running process shows it is working): `components/ActivityBar.js` (root layout) shows a top bar while any same-site request runs (server actions, page loads, API routes; database polling excluded; appears after 200 ms). `components/Progress.js`: `<Spinner />` when the time is unknown, `<TimedProgress seconds label />` when it is roughly known (fills to 95%, "about N s left"). Busy buttons get `aria-busy` (CSS spinner); `FormState` does it automatically; `loading.js` in `/app` and `/admin`. New long actions must use one of these.
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
