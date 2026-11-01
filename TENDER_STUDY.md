# Tender study — what tenders ask for that Dhandha does not handle yet

Started 1 Nov 2026 on the owner's request: read as many tenders as possible, across every industry, department and
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

## Questions for the owner (answer any time; work continues)

| # | Question | Options | Answer |
|---|---|---|---|
| Q1 | Bid capacity (F1): work it out automatically for works tenders? | Yes / No / Later | |
| Q2 | Manpower wage sheet (F8): load the minimum wages of each state (Central plus all states; they change twice a year)? | Yes, all states / Only Central / Later | |
| Q3 | Reverse auction (F4): add a "how low can we go" floor price in the price step for GeM bids? | Yes / Later | |
| Q4 | CA-firm points (F6): work out empanelment points for bank-audit tenders free from Key people? | Yes / Later | |
