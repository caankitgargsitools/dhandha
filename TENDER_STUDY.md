# Tender study — what tenders ask for that Dhandha does not handle yet

Started 1 Nov 2026 on the owner's request (first round 1 Nov: 77 GeM bids read across CA audit, IT, supply and services / works): read as many tenders as possible, across every industry, department and
kind of tender; find conditions, formats, evaluation and price methods Dhandha does not yet handle; list them here
with questions for the owner. Questions never block the work — they wait here (and in PENDING.md) until answered.

**How tenders are gathered.**
- **GeM:** bid documents are public PDFs, with no captcha. They are fetched in bulk outside market hours:
  - 15 every 15 minutes from 15:45 to 08:30 India time on weekdays;
  - all day on Saturday and Sunday.
- **State and PSU portals (GePNIC):**
  - Fetching a tender's documents needs a captcha typed by a person.
  - The twice-daily format harvest (8 a run) uses the morning captcha session.
- **Where the reading goes:**
  - Every fetched tender is read by the free reader.
  - Its full text is kept in `tender_texts`, and its formats go into the format catalogue (Admin → Format catalogue).
  - Claude reads the texts in batches by industry and records what is new here.

**Status columns.**
- **Have:** Dhandha already handles it.
- **Part:** partly handled.
- **New:** not handled yet.
- **Q:** waiting for the owner's answer.

## Findings

| # | Found in (industry / department) | What the tender asks for or how it works | Dhandha today | Proposal | Status |
|---|---|---|---|---|---|
| F1 | CPWD and other works departments | **Bid capacity** = (A × N × M) − B. A = the best year of work done in the last 5 years, raised to today's prices. N = the completion period. M = 2 to 3. B = work still in hand. | Part: a statement format only | Work it out from the Vault's works and turnover, and warn when bid capacity is below the estimate | New |
| F2 | CPWD and other works departments | Similar work counted in the **last 7 years** at **40 / 60 / 80 %** of the estimate (one work of 80 %, or two of 60 %, or three of 40 %). Older works are raised by 7 % a year. | Part: the thresholds only | Raise older works by the stated rate before comparing; show which works qualify | New |
| F3 | GeM | The turnover asked for is capped at 0.5 × the bid value. Traders do not get the MSE exemption from EMD. A seller exempt from EMD signs a Bid Securing Declaration instead. | Part | Check the cap; ask once "manufacturer / service provider or trader?"; add the declaration automatically | New |
| F4 | GeM | Bid-to-reverse-auction: after the technical stage, prices are cut live. H1 bids are knocked out (often the top 50 %). | No | Explain reverse auctions in the price step; plan a floor price | New |
| F5 | Purchases above ₹10 crore under Make in India | A CA or statutory auditor must certify local content. Class-I supplier ≥ 50 %, Class-II ≥ 20 %. Class-I gets purchase preference (L1 + 20 % margin). | Part: the formats exist | Ask the local-content % once; tell the bidder which class they are and what preference they get | New |
| F6 | Bank audits, PSUs | Firms are chosen by a points table: partners, FCAs, CISA/DISA holders, years, staff, branches, turnover. | Part: technical marking by AI | Work out the CA-firm points free from Key people | New |
| F7 | All | Performance security is 3–10 % of the contract value (GFR 171) and must stay valid 60 days past warranty. A bank guarantee goes through SFMS. | Part: EMD & BG register | Work out the amount and the date it must stay valid until, and add it to the bank-limit warning | New |
| F8 | Manpower tenders | Wage sheet: minimum wage + VDA, EPF 13 %, ESI 3.25 %, bonus 8.33 %, leave, uniform, service charge (often with a floor), GST 18 %. Bids with 0 % service charge get rejected. | Part: the cost planner | A template per state with the state's minimum wages; warn below the floor | New |
| F9 | Works | Rebate on the quoted rate, and quoting above or below the estimated rate. Bids quoted "below" too far can be asked for an additional performance guarantee (unbalanced bids). | No | Warn when the quote is more than 10–15 % below the estimate | New |

| F10 | GeM, all industries (77 bids read 1 Nov) | **The real conditions sit in attached PDFs** — buyer ATC, scope of work, payment terms, penalties, PQC, BOQ, sometimes a whole RFP — linked from the bid ("Click here to view the file"). Seen in 14/20 CA, 10/20 IT, 12/20 supply, 14/17 services/works bids | No: only the main bid PDF is fetched | Fetch and read every attachment of a GeM bid; until then the brief says "conditions in attachments not read" | Q |
| F11 | GeM, all | **Bid details are labelled fields in every GeM bid**: turnover and OEM turnover, years of experience, past performance %, bid-to-RA on/off, evaluation method (total / group / item-wise), inspection, EMD per schedule, ePBG % (0.01–10) and ePBG months (1–86), MII / MSE preference | No: read only as free text | A free parser that turns these into data and feeds eligibility, deposits and the price step | Q |
| F12 | GeM, all | **MSE purchase preference**: within L1+15 % (sometimes 20 %) an MSE may match L1 — 25 % of a goods order, 100 % of a services order, whole order if indivisible; manufacturers only (not traders); some only for MSEs of the buyer's state; Make in India Class-I preference L1+20 % up to 50 %; bids reserved for MSEs or PSUs only | Part: MSE EMD exemption only | Show "match L1" scenarios and the share an MSE could win; reserved bids as a hard stop for others | Q |
| F13 | GeM, all | **Option clause ±25 % (often ±50 %)** of quantity / duration / value, binding at the quoted rates | No | Cost planner shows margin and manpower at −25 / −50 / +50 %; size the guarantee and bank limits on the upper value | New |
| F14 | GeM services | **Pay wages first, claim later** with PF/ESI challans and bank proof (by the 7th); TReDS named as the payment route; payment 21–45 days after the receiving certificate, or after the final report | Part: cost planner has no cash-flow line | Working capital needed = monthly wage bill × months until paid; add bank-guarantee charges; ask once "on TReDS?" | Q |
| F15 | GeM, PSU | **Deposits beyond F7**: ePBG months stated exactly; railway 5 % in four parts; hard-copy EMD / FDR / DD within 5 days of closing, performance DD within 15 days of award; maintenance guarantee 2 % with AMC ≤ 3–5 % a year; some bids allow no EMD exemption at all (overrides MSE) | Part: deposits register | Read amount + months, compute expiry and bank charge, courier deadlines into the bid plan and calendar | New |
| F16 | GeM, Railways / PSU | **Financial tests beyond average turnover**: aggregate turnover ≥ 1.5 × value over 3 years + current; liquid assets ≥ 5 % of value with a bank letter ≤ 3 months old; positive net worth each year; profit in each of 3 years; best 3 of 5 years; ITRs for 3 years | Part: average turnover only | Compute from the Vault's financial facts; CA certificate formats for liquid assets / net worth; dated bank letter on Get ready | Q |
| F17 | GeM, IOCL, Railways | **Which experience counts**: one work ≥ 35 % (railways) or 35/20/15 % (goods) or 80/50/40 % (services); running contracts count once 35 % billed; private clients only if client turnover ≥ ₹500 cr; ARC/AMC annualised; JV works at the bidder's share; sub-contracts need the owner's certificate; values incl. GST; executed value not order value; supply experience in **quantity** (10–80 % of bid quantity in a year) and in **each** of N years | Part: CPWD 40/60/80 % rule | Store client type, share %, sub-contract, GST flag, billed value, quantity per product per FY on each work; apply the tender's rule | New |
| F18 | GeM, IT / supply | **OEM vs reseller**: OEM turnover and net worth, bid-specific MAF ("one bid one OEM"), brand or approved-vendor whitelists, service centre per consignee state, toll-free number + escalation matrix, 3–7 years of product life left, AMC ≤ 3 % a year | Part: MAF format only | "OEM partners" in the Vault (authorisations with expiry, OEM turnover, ISO, service centres); whitelist as a hard condition; escalation-matrix and AMC formats | Q |
| F19 | GeM, CA audit | **CA-firm pass/fail criteria**: years since the ICAI firm certificate, minimum CAs / partners, DISA / CISA count, full-time staff, C&AG empanelment, partnership only, office within a city's limits; outgoing statutory / tax / internal auditor barred | Part: points table (F6) only | Check free from the Vault (FRN date, Key people with membership no. and DISA/CISA, staff count) | Q |
| F20 | GeM, all | **Bids reserved for a named vendor / OEM** ("reserved only for M/s …", supervisory services of an OEM) | No: shown as matches | Free rule: "Not for us (reserved for X)", kept out of matches | Q |
| F21 | GeM, all | **Local presence in a city**, not just a state (Jabalpur, Prayagraj, Kanpur, Pune limits), proved by GST / Udyam / shop licence (rent agreement not accepted); or "undertaking to open within 30 days" | Part: state-level condition | City-level condition; accepted proofs from the Vault; offer the undertaking format where allowed | New |
| F22 | GeM, all | **Registrations and recognitions as gates**: CERT-In empanelment, MES enlistment class, NABL lab, ISO 27001 / 9001 / 14001 / 45001, CIF safety-auditor recognition, GST zero-outstanding certificate, mandatory site-visit certificate | Part: C&AG, ISO, peer review | Add these to `findPrerequisites` and as Vault facts with issuer and validity | New |
| F23 | GeM, all | **Rejection traps**: any price in the technical bid; unsigned compliance sheet; "unnecessary documents" uploaded; one folder per document; acceptance letter dated after publication; every page signed; datasheet ≠ specification; same IP address as another bidder; fee ceiling (above → rejected); buyer floor price per schedule | Part | Pre-submission checklist; keep the preparation / cost sheet out of the technical upload; warn below a floor / above a ceiling | New |
| F24 | GeM, all | **Delivery, LD and inspection**: LD 0.5 % a week capped at 10 %; warranty penalty 0.5 % of unit price a week; delivery clock starts after drawing / proof / inspection approval; advance sample by 2 days after closing; pre-dispatch inspection; government-lab test | No | Delivery-timeline and "1 week late costs ₹X" in the brief; sample deadline into the bid plan | New |
| F25 | GeM, all | **Unfilled buyer templates** ("at least XX projects …", "YY") and buyer terms that conflict with the portal fields (e.g. EMD ₹25 lakh total vs per-schedule) | No | Spot XX/YY → treat as unclear and draft a pre-bid query automatically; show conflicts between ATC and portal fields | New |
| F26 | GeM, all | **GeM extends the closing date itself** by 3–7 days (up to 3 times) when fewer than N bids arrive | Part: corrigendum alerts from re-crawls | Re-read the GeM end date in the last hours and alert on change | New |
| F27 | Dhandha itself | **Industry tagging is too broad**: 13 of 20 "CA audit" bids were energy / fire / structural / cyber audits; 15 of 20 "IT services" bids were manpower outsourcing | Bug | Tighten `industry_pack` on the crawler side (same blockers as the CA pack) and use `sectorOf` for the catalogue | Fixing |

## Questions for the owner (answer any time; work continues)

| # | Question | Options | Answer |
|---|---|---|---|
| Q1 | Bid capacity (F1): work it out automatically for works tenders? | Yes / No / Later | |
| Q2 | Manpower wage sheet (F8): load the minimum wages of each state (Central plus all states; they change twice a year)? | Yes, all states / Only Central / Later | |
| Q3 | Reverse auction (F4): add a "how low can we go" floor price in the price step for GeM bids? | Yes / Later | |
| Q4 | CA-firm points (F6): work out empanelment points for bank-audit tenders free from Key people? | Yes / Later | |
| Q5 | Fetch and read **every attachment** of a GeM bid (ATC, scope of work, RFP) — free, a little more storage (F10)? | Yes / No | |
| Q6 | Build the free **GeM bid-details parser** that drives eligibility, deposits and the price step (F11)? | Yes / No | |
| Q7 | Show **MSE / Make-in-India "match L1"** scenarios and the share of the order in the price step (F12)? | Yes / Later | |
| Q8 | Add **working capital** (wages first, payment days) and guarantee charges to the cost planner (F14)? | Yes / Later | |
| Q9 | Check **railway / PSU financial tests** (aggregate turnover, liquidity, net worth, profit each year) from the Vault (F16)? | Yes / Later | |
| Q10 | Keep **OEM partners** and product-wise supply quantities per year in the Vault for resellers (F18)? | Yes / Later | |
| Q11 | Store **ICAI firm details** (FRN date, CAs, partners, DISA/CISA, staff, C&AG empanelment) and check CA-firm criteria automatically (F19)? | Yes / Later | |
| Q12 | **Hide bids reserved for a named vendor** from matches automatically (F20)? | Yes / No | |
