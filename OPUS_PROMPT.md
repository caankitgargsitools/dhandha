# Brief for Opus — Dhandha portal: close the gaps, win more business, premium GUI

*Written 4 Nov 2026 after a full read of the portal (tenders, leads/CRM/outreach/sales, Vault/admin/billing/onboarding, GUI). Give this whole file to Opus as its opening message. It has the repository; it should read `CLAUDE.md` first and treat its ground rules as binding.*

---

## 0. Who you are and how to work

You are the lead engineer on **Dhandha** (`caankitgargsitools/dhandha`), a multi-tenant "get more business" suite for small Indian firms (CA firms, security / manpower agencies, IT resellers, contractors): government tenders end-to-end, a document Vault, lead generation, CRM, WhatsApp outreach, sales scheduling, quotes and invoices. Next.js 16 (App Router, plain JS), Supabase (Postgres + RLS + SQL functions), Vercel (Mumbai), own crawler on an AWS Mumbai server.

Rules you must keep (from `CLAUDE.md`):
- **Cost order free → cheaper → costlier** for every AI or paid step. Never start at a paid tier when a free one can try. Gemini free tier only gets public tender text (`private:false`); customer data goes to paid tiers only.
- **Own crawler only; never bypass or auto-solve captchas.** Signatures need the admin's TOTP. No credentials in chat. Secrets only in Vercel env / Supabase Vault.
- **Non-destructive database changes** (archive / flag, never delete; no `DROP`). Demo rows go in `demo_seed`.
- Design system: "clean SaaS" — slate neutrals, one indigo accent (`--primary`), Inter, flat white cards, light + dark, ☰ drawer menu. **Tokens, never hex, in pages.** Every running process shows it is working (`ActivityBar`, `Spinner`, `TimedProgress`, `aria-busy`).
- Keep pure logic in `lib/*.js` with tests in `tests/*.test.mjs` (`node --test tests/*.test.mjs`; crawler `cd crawler && npm test`). Run `npx next build` before every PR.
- Branch → commit → PR → squash-merge to `main` (deploys to production). Small PRs, one theme each. Update `CLAUDE.md`'s map and `PENDING.md` as you go.
- Ask the owner (CA Ankit Garg, "Papa") only when a product decision truly needs him, one question at a time, Yes / No / "Put it in pending list". Otherwise decide and build.

Work in the order below (bugs → daily-use flows → new business → GUI). Each numbered item is one PR unless noted. Finish each with tests, a build, and a one-line entry in `PENDING.md` "Done".

---

## 1. Bugs and safety first (do these before anything else)

1. **Invoices to the wrong company.** `app/app/wallet/actions.js` invoices whichever company is selected in the top bar. Add a fixed *billing company* per workspace (default: the first company) and always invoice it; prefill from it too.
2. **No "forgot password" and no 2FA reset.** Add a reset flow through a real mailer (Resend when `RESEND_API_KEY` exists; otherwise show the admin a copyable reset link) and an admin "Reset authenticator" button on `/admin/tenants/[id]` that removes the TOTP factor and writes an audit row.
3. **Deep links lost at sign-in.** `proxy.js` drops the query string and `signIn` always lands on `/app`. Carry `?next=` through sign-in and 2FA (reuse `safeNext`).
4. **Empty workspace crashes every page.** `lib/session.js` throws when `allCompanies` is empty. Guard it and send to onboarding.
5. **Vault deletes are destructive.** `deleteRow` hard-deletes `documents` rows and leaves files behind; replacing a signature deletes the old asset. Switch to `status='archived'` / `replaces_id`, keep old versions.
6. **AI read spent then thrown away.** `readActions.js`: save the `tender_reads` row *before* `spend_credits`, as `bidActions.js` already does.
7. **Hindi text vanishes from bid PDFs.** `lib/bidpack.js` `clean()` strips every non-Latin-1 character. Embed Noto Sans Devanagari (subset) and keep the text.
8. **Invite links confirm the e-mail.** Make invite tokens single-use, expire in 72 h, show expiry on Team.
9. **Silent failures:** `setTenderStatus` form errors are never shown; cost-planner autosave ignores errors; a failed Google-Docs pull builds a stale pack without warning; `collectDocs` leaves a job `fetched` when storing one file fails and only offers a full re-fetch. Surface each error and add the right retry.
10. **Re-match formats overwrites the user's work.** `formatActions.js` "Re-match formats (free)" rebuilds the plan and drops `tpl`, `stamp`, `gdoc`, `outside` and user-added formats. Route it through `chooseFormats` or remove it.

---

## 2. Free-first and never-ask-twice (tenders)

1. Opening the assistant must **not** auto-start the 99-credit AI read. Run / reuse the free reader (`precheck` read) first; offer AI only for scanned or non-English pages or when free confidence < 60, and ask before spending. The low-wallet path must fall back to the free reader, not error.
2. "Basic reading" charges 10 credits for the free rules engine — make it free.
3. Technical marking (29 credits) when `fields.points` already exists: build `tech_eval` from the free points table; AI only when there is none.
4. "Fill N custom with AI" must fill only formats with no text yet and reuse `fillCustom`'s one-charge guard.
5. "Ask anything" (3 credits): answer from `read.fields` free when the question is a known field (EMD, closing, validity, fee, performance security…); public-text questions go to the free tier first.
6. **One master-questions queue.** The tender page "Fill these once" box, `FormatsPanel` gaps, the assistant and Vault → Masters all ask differently. Make `missingMasters` the single queue and link to it from everywhere. Default `place` to the company city (it is asked every tender today). Store net worth consistently (period = FY everywhere). Save works with work-order no., start date and scope so formats stop asking.
7. **Use what is read but ignored:** `similar_work_definition` (match against `experience_items`, show the best 3 works and the gap), `turnover_years` (feed `apply_tender_read`), `language` (flag Hindi tenders), `priced_at` ("price is older than the last corrigendum"), `tech_eval.min_tech_score` (warn at the brief).

---

## 3. Finish the tender journey (discover → qualify → prepare → file → win → get paid)

1. **Deadline cockpit** (`/app/tenders/closing`, card on Tenders and Home): every match being prepared, sorted by closing time, with a live countdown (red < 48 h) and a readiness ring (documents ✓ / formats ✓ / price ✓ / sign-offs ✓). Push + (when configured) e-mail at 72 h, 24 h and 6 h if not yet submitted.
2. **File-it step** at the end of the assistant: sign (TOTP) → **upload kit** (merge the real Vault PDFs into the slots a GePNIC / GeM bid expects — fee/EMD, technical, financial — compressed within portal size limits, each slot ticked as uploaded) → DSC expiry vs closing check → "Upload submission receipt / bid id" → status `submitted`; the EMD becomes a `bid_deposits` row automatically.
3. **Results fill themselves:** link crawled `tender_awards` / AOC to the firm's own submitted matches (`norm_firm`), set won / lost, rank and L1; `ResultForm` only for what the crawler missed.
4. **After the award** (new section on a won tender): LoA / work order capture; performance-security due date → deposit row; agreement deadline; running bills → `invoices` (GST, TDS, retention) tracked against `payment_days`; completion-certificate request letter; on completion an automatic `experience_items` entry so every win counts for the next tender.
5. **Corrigendum re-read with a diff:** on a `tender_changes` row, re-queue the doc fetch, re-run the free reader, and show what changed (dates, EMD, eligibility, BOQ, formats); mark formats and price that need another look.
6. **Duplicate tenders across portals** (CPPP + state portal, GeM + CPPP): one match keeping both links (title + authority + closing within 48 h).
7. **Go / no-go card and tender comparison:** compare 2–4 tenders side by side (value, EMD, eligibility gaps, `bidChance`, price-to-win, effort); "Not for us" / "Skip" ask a reason from a short list (feeds `matchLearning`).
8. **Clone from a past bid** (same formats, edited text, cost sheet, team) and a "similar work" matcher ranking works against the thresholds.
9. **Team per tender:** comments with @mentions and watchers (a `tender_comments` table, pushes), "Ask a bid preparer" for roles that cannot read (task + push instead of a dead end), unassigned bid tasks shown as unassigned.
10. Portals we cannot fetch from (nProcure…) say so up front with the portal link and an upload button, not a failed fetch.

---

## 4. Win the business faster (leads, CRM, WhatsApp)

1. **"Today" call list** (`/app/today`, also the Home page's first panel): one queue joining `leads.next_follow_up_at`, `deals.next_action_at`, `tasks` and meetings, ordered overdue → hot → new. Tap Call → phone dials → on return a bottom sheet shows **one-tap outcomes** (Connected · No answer · Busy · Wrong number · Not interested · Interested · Meeting fixed); a next date-time is required unless the outcome closes the lead; then the next lead opens.
2. **Outcome rules + snooze:** no answer → retry tomorrow 11:00 (three misses → nurture playbook); wrong number → flag phone; not interested → closed with a reason from a list (`lost_reasons` table, analysed in Results); snooze +1 h / tomorrow / next Monday. Follow-ups get a time, not just a date.
3. **One lifecycle:** lead status and deal stage driven by the same outcomes; several open deals per lead allowed (a CA sells audit and GST retainer at once); a deal opens on a qualifying event (interested / reply / meeting / quote), not on every import; pipeline page limited and paged.
4. **Stage-aware WhatsApp:** a template per stage (first touch, after call, meeting reminder, proposal follow-up, payment reminder) picked beside the WhatsApp button; placeholders for rep name, meeting time, quote link / amount, invoice balance, services; Cloud API templates **synced from Meta** with per-variable field mapping and header media; **send PDFs** (quote, invoice, brochure) as documents; from the inbox: log outcome, open deal, move stage, book meeting.
5. **Meeting done → ask the outcome and next step**, offer "Make quotation"; no-show → ready WhatsApp with a rebooking link.
6. **Quote → advance → onboarding:** payment link (UPI / Razorpay when on) on acceptance; "Advance received" before Won; quote versions (v2 after negotiation), optional lines; auto follow-up when a quote is seen but unanswered 48 h; after Won a client onboarding checklist (documents requested through the existing Vault upload flow, kick-off meeting).
7. **Duplicates and merge:** a "Possible duplicates" queue on `name_norm`, GSTIN, phone variants, e-mail domain; merge moves activities, deals, meetings, quotes, threads and leaves a pointer row (no delete). Manual add of an existing lead links to it.
8. **Engagement score:** add decaying points for replies, quote views, meetings, repeat enquiries, inbound vs cold; show "Hot because…"; inbound first in lists.
9. **New sources Indian firms actually use:** IndiaMART Lead Manager API pull (15 min) with routing + instant push (target: first call within 5 min); JustDial / Sulekha e-mail leads via the existing e-mail hook with the right source tag; a QR code to `/f/[token]?event=` for stalls; visiting-card photo → lead (paid AI, `private:true`, after a free OCR attempt); webinar registrant CSV; UTM / gclid split from the widget's page URL so Google Ads vs SEO show in Results by source; partner referral links (lawyers, bankers).
10. **Manager dashboard** (`/app/crm/team`): activities per rep per day (calls, connects, messages, meetings), first-response time per lead / thread with an SLA rule that reassigns untouched leads, stage-to-stage conversion and speed, stage ageing on every card, lost reasons, quote win rate and average discount. India time everywhere (`crm/page.js` "won this quarter" uses the server clock).

---

## 5. First run, Vault, team, billing, admin

1. **GSTIN-first onboarding wizard:** GSTIN or GST certificate upload (→ `freeRead` fills name, PAN, address, constitution) → What we do → first matching tenders. A dismissible **Getting-started checklist** on Home that ticks itself off (services, GST/PAN certificate, letterhead, invite a teammate, open your first tender). One readiness number everywhere = `masterStatus` progress (Home, Vault home and Masters disagree today). Empty states say *why* and give the next button.
2. **Home = Today:** tasks, meetings today, bids closing in 72 h, overdue follow-ups, new matches not yet looked at, expiring documents, low credits; manager strip of overdue work per person. Make "Best matches" rows clickable.
3. **Vault:** view / download link per document; **Renew** on expiring documents (`replaces_id`, old copy archived, type pre-filled); bulk upload with automatic type detection; **document pack sharing** (pick documents → zip or expiring link with a download log — for a client, JV partner or CA); per-company membership and a "sensitive documents" permission (balance sheets, ITRs, PAN only for admins / managers / bid preparers); import Experience / Key people from Excel.
4. **Notification centre:** `notification_prefs(user, event, channel)` honoured by every `push_*`; quiet hours; in-app bell with history; e-mail channel when Resend is on.
5. **Profile page** (name, phone, password, e-mail, active sessions); Team: Restore a removed member, last-admin guard; audit log with actor, filters, CSV export, team and billing events.
6. **Billing:** trial-end behaviour decided and shown (reminder day 5); low-credit push + e-mail, optional auto top-up; invoice PDF (reuse `buildQuotePdf`) e-mailed; usage by module; coupons / partner pricing; annual plan; GSTIN editable at checkout; credit notes.
7. **Admin support console:** read-only view-as, per-tenant usage (AI spend, credits by action, last login, features adopted), extend trial / suspend / change plan / reset 2FA, sign-up funnel, announcements; page every admin list.
8. **DPDP kit:** export everything (ZIP of JSON/CSV + Vault files), delete workspace (soft now, purge after 30 days, logged), consent timestamp at sign-up, privacy / retention page.
9. **Security hygiene:** role / ownership checks inside server actions (`setTaskStatus`, `deleteRow` by company, `saveFact` key whitelist, `addMember` validation, `switchCompany` membership check); rate limits on sign-up, sign-in, tickets, invites, public forms.

---

## 6. GUI — make it feel premium on a phone

Do the **first sprint** first: contrast + dark-mode fixes, bottom tab bar, skeletons, compact tender cards, Today home. Then the rest.

1. **Design-system clean-up:** move the 1,100+ inline `style={{}}` to classes / tokens (worst: `tenders/[id]/page.js`, `Assistant.js`, `CostPlanner.js`, playbook `Builder.js`); one progress class; one tabs component; one primary button (retire `.gold`), ghost secondary, danger; `--primary` only (retire `--madder`, `--marigold` aliases); `<Icon>` only (no text glyphs); one empty-state component (icon + why + next action); fix dark-mode hex borders and chip colours; `--ink-3` and `.chip.ok` contrast to WCAG AA; a lint rule blocking hex colours and inline font sizes in pages.
2. **Bottom tab bar on phones** (Home · Tenders · Leads · Pipeline · More), top bar slimmed to one row (company switcher becomes a searchable sheet with recent / pinned, workspaces separated).
3. **Tables → cards below 600 px**, 44 px touch targets, no fixed `minWidth` inputs, bottom sheets for long forms (filters, add lead, new deal), filter chips + **saved views** ("Delhi civil under ₹50 L").
4. **Compact tender cards:** score ring, title, buyer, value, days left, one eligibility traffic light, two actions; everything else on expand. **Tender deal room:** sticky header with countdown + readiness ring + stage control, sections Overview · Eligibility · Documents · Price · Pack · Results.
5. **Assistant as a full-height chat** (the owner also asked for a **full-screen toggle button — a ⤢ "cross-arrow" icon at the right of the chat header** — that expands the assistant to fill the screen on phone and desktop, Esc / ⤡ to return; this one is small and should ship first), pinned composer, quick-reply chips, big forms (cost planner, annexure editor) in a bottom sheet / side panel, typing dots for short waits, cost shown once as a badge.
6. **Kanban pipeline with drag-and-drop** (drop into Lost asks the reason), scroll-snap on mobile, grouped list on phones, ageing chip.
7. **Swipe actions** on tender / lead / task lists (right: shortlist · call · done; left: skip · snooze), **optimistic UI with undo toast** for shortlist, skip, done, move, mute; **inline editing** (deal value, next step, dates, Vault facts) saving on blur.
8. **⌘K command palette** (tenders, leads, deals, Vault, actions, recent) + keyboard shortcuts (`j`/`k`, `s`, `/`, `g t`, `?`).
9. **Skeleton loaders per route**, **notification bell**, light / dark / system switch, micro-animations respecting reduced motion, **celebration + shareable "Won ₹X" card** on a won tender or deal, `@media print` views for bid sheet, quotes, invoices.
10. **Hindi / Hinglish UI toggle** (strings table, start with navigation, buttons, tender page, assistant) and **voice input** (browser speech, hi-IN / en-IN) for notes and assistant answers.
11. Accessibility: real `aria-current` links instead of fake tabs, drawer focus trap and return, visible labels, `role="status"` / `alert` on `FormState` messages, narrow `aria-live` region in the chat, `lang="hi"` on Devanagari.
12. Remove: the tenders donut, Home "Credits left" tile, per-card Move dropdowns, the stacked "Bid tools" row (→ one "More ▾" menu).

---

## 7. Acceptance

- Every PR: tests green, `next build` clean, no new inline hex / font sizes, mobile checked at 360 px (Playwright screenshot in the PR description), dark mode checked.
- Keep `CLAUDE.md` "Map of the code" and `PENDING.md` current; each new table or function named there.
- When something needs the owner (a Meta app, Resend key, IndiaMART key, Razorpay), build everything up to the switch, add a one-line "Waiting on you" item in `PENDING.md`, and move on.
