import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGemFields, gemReadFields, gemLines, isGemBid } from "../lib/gemFields.js";

// Real GeM bid text as the free PDF reader returns it (GEM/2026/B/8212942 and 8147037, shortened): Hindi labels with
// doubled glyphs, then the English label and the value.
const bid = `\u0001बड\u0001बड \u0001ववरण\u0001ववरण//Bid Details
\u0001बड\u0001बड बंदबंद होनेहोने क\u0010क\u0010 तार\u0013खतार\u0013ख//समयसमय /Bid End Date/Time 07-11-2026 20:00:00
\u0001बड\u0001बड पेशकशपेशकश वैधतावैधता ((बंदबंद होनेहोने क\u0010क\u0010 तार\u0013खतार\u0013ख सेसे)) /Bid Offer
Validity (From End Date) 180 (Days)
मं ालयमं ालय//रा!यरा!य काका नामनाम /Ministry/State Name Ministry Of Finance
\u0001वभाग\u0001वभाग काका नामनाम/Department Name Department Of Financial Services
संगठनसंगठन काका नामनाम /Organisation Name State Bank Of India (sbi)
काया%लयकाया%लय काका नामनाम /Office Name Lho Lucknow
कुलकुल मा ामा ा/Total Quantity 1013
\u0001बड सं7या/Bid Number: GEM/2026/B/8212942
1 / 14\f\u0001पछले\u0001पछले 33 \u0001वFीय\u0001वFीय वषGवषG काका \u0001बडर\u0001बडर काका HयूनतमHयूनतम औसतऔसत वा\u0001ष%कवा\u0001ष%क
\u0001वFीय\u0001वFीय टन%ओवरटन%ओवर/Minimum Average Annual
Turnover of the bidder (For the last 3
Financial Years)
10 Lakh (s)
उHह\u0013ंउHह\u0013ं//समानसमान सेवासेवा केके िलएिलए अपे-Lतअपे-Lत \u0001वगत\u0001वगत अनुभवअनुभव केके
वष%वष%/Years of Past Experience Required for
same/similar service
3 Year (s)
एमएसएमईएमएसएमई केके िलएिलए/MSE Relaxation for Years of
Experience and Turnover
Yes | Complete
'टाट%अप'टाट%अप /Startup Relaxation for Years of
Experience and Turnover
No
\u0001वMेता\u0001वMेता सेसे मांगेमांगे गएगए द'तावेज़द'तावेज़/Document required
from seller
Experience Criteria,Past Performance,Bidder Turnover,OEM
Authorization Certificate
*In case any bidder is seeking exemption
आवUयकआवUयक \u0001बड\u0001बड क\u0010क\u0010 सं7यासं7या।। / Minimum number of
bids required to disable automatic bid
extension
3
8दनO8दनO क\u0010क\u0010 सं7यासं7या,, / Number of days for which Bid
would be auto--extended
3
ऑटोऑटो / Number of Auto Extension count 3
\u0001वगत\u0001वगत 5दश%न5दश%न /Past Performance 80 %
\u0001बड\u0001बड सेसे 0रवस%0रवस% नीलामीनीलामी स8Mयस8Mय 8कया8कया/Bid to RA enabled No
\u0001बड\u0001बड काका 5कार5कार /Type of Bid Two Packet Bid
2 / 14\fिनर\u0013Lणिनर\u0013Lण आवUयकआवUयक (सूचीब^सूचीब^ िनर\u0013Lणिनर\u0013Lण 5ािधकरण5ािधकरण)/Inspection Required (By
Empanelled Inspection Authority / Agencies
pre-registered with GeM)
No
Payment Timelines
Payments shall be made to the Seller within 45 days of
issue of consignee receipt-cum-acceptance certificate
मू[यांकनमू[यांकन प^ितप^ित/Evaluation Method Total value wise evaluation
ईएमड\u0013 रािश/EMD Amount 20800
ईपीबीजी 5ितशत (%)/ePBG Percentage(%) 5.00
ईपीबीजी क\u0010 आवUयक अविध (माह) /Duration of ePBG
required (Months). 12
एमएसई खर\u0013द वर\u0013यता/MSE Purchase Preference Yes
/ Purchase
Preference to MSE OEMs/ Service Provider
available upto price within L1+X%
15
/ Percentage of Bid quantity/amount for
MSE OEMs/ Service Provider Purchase preference
25
This Bid provides for Trade Receivables Discounting System (TReDS) as Preferred mode of payment.
एमआईआई खर\u0013द वर\u0013यता / MII Purchase Preference Yes
Buyer uploaded ATC document Click here to view the file .
OPTION CLAUSE 25% : The buyer can increase or decrease the contract quantity or contract duration up to
25 percent at the time of issue of the contract.`;

test("a GeM bid's labelled fields become data", () => {
  assert.equal(isGemBid(bid), true);
  const g = parseGemFields(bid);
  assert.equal(g.bid_no, "GEM/2026/B/8212942");
  assert.equal(g.end_at, "07-11-2026 20:00:00");
  assert.equal(g.validity_days, 180);
  assert.equal(g.ministry, "Ministry Of Finance");
  assert.equal(g.organisation, "State Bank Of India (sbi)");
  assert.equal(g.total_qty, 1013);
  assert.equal(g.turnover_lakh, 10);
  assert.equal(g.experience_years, 3);
  assert.equal(g.mse_relaxation, "Yes | Complete");
  assert.equal(g.startup_relaxation, "No");
  assert.equal(g.past_performance_pct, 80);
  assert.equal(g.bid_to_ra, false);
  assert.equal(g.bid_type, "Two Packet Bid");
  assert.equal(g.inspection, false);
  assert.equal(g.payment_days, 45);
  assert.equal(g.evaluation, "Total value wise evaluation");
  assert.equal(g.emd_inr, 20800);
  assert.equal(g.epbg_pct, 5);
  assert.equal(g.epbg_months, 12);
  assert.equal(g.mse_preference, true);
  assert.equal(g.mse_margin_pct, 15);
  assert.equal(g.mse_share_pct, 25);
  assert.equal(g.mii_preference, true);
  assert.equal(g.option_pct, 25);
  assert.equal(g.treds, true);
  assert.equal(g.auto_ext_min_bids, 3);
  assert.equal(g.auto_ext_days, 3);
  assert.equal(g.auto_ext_count, 3);
  assert.equal(g.atc_attached, true);
  assert.match(g.documents_required, /^Experience Criteria,Past Performance,Bidder Turnover,OEM Authorization Certificate$/);
});

test("the figures land in the reader's own fields and in plain lines", () => {
  const g = parseGemFields(bid);
  assert.deepEqual(gemReadFields(g), { req_avg_turnover: 1000000, emd_inr: 20800, bid_validity_days: 180, performance_security_pct: 5, req_similar_years: 3 });
  const lines = gemLines(g).join("\n");
  assert.match(lines, /₹10 lakh — MSEs: relaxed \(Complete\)/);
  assert.match(lines, /ePBG\) 5% for 12 months/);
  assert.match(lines, /L1\+15% may match L1 for 25% of the order/);
  assert.match(lines, /Option clause: .* 25%/);
  assert.match(lines, /attached files/);
  assert.equal(parseGemFields("An ordinary NIT of CPWD"), null);
});

test("MSE / Make in India: who may match L1, and for how much", async () => {
  const { matchL1 } = await import("../lib/gemFields.js");
  const gem = { mse_preference: true, mse_margin_pct: 15, mse_share_pct: 25, mii_preference: true, total_qty: 1013 };
  let r = matchL1({ gem, msme: true, classOne: true, ourPrice: 110000, l1Price: 100000 });
  assert.match(r.find((x) => x.kind === "mse").line, /match L1 at ₹1,00,000 for 25% of the order/);
  assert.match(r.find((x) => x.kind === "mii").line, /for 50% of the order/);
  assert.match(r.find((x) => x.kind === "net").line, /for 50% of the order/);
  r = matchL1({ gem, msme: true, ourPrice: 120000, l1Price: 100000 });
  assert.equal(r.find((x) => x.kind === "mse").ok, false);
  assert.match(r.find((x) => x.kind === "mse").line, /Come down by ₹5,000/);
  r = matchL1({ gem: { ...gem, total_qty: 1 }, msme: true, ourPrice: 105000, l1Price: 100000, l1IsMse: true });
  assert.match(r.find((x) => x.kind === "mse").line, /L1 is itself an MSE/);
  assert.equal(matchL1({ gem, msme: true, ourPrice: 90000, l1Price: 100000 })[0].kind, "l1");
  assert.deepEqual(matchL1({ gem: null, ourPrice: 1, l1Price: 1 }), []);
});

test("a bid reserved for one named vendor (real GeM wording)", () => {
  const head = "Bid Details GEM/2026/B/8000001 Bid End Date/Time 10-11-2026 12:00:00\n";
  assert.equal(parseGemFields(head + "THIS IS AN OEM TENDER. Bidders to note that this GeM bid is reserved only for proprietary vendor M/s. CELLCOMM SOLUTIONS LIMIT ED Other bidders are not acceptable.").reserved_for, "M/s. CELLCOMM SOLUTIONS LIMIT ED");
  assert.equal(parseGemFields(head + "Reserved for Make In India products Yes. Reserved for MSE Yes").reserved_for, undefined);
});

test("reverse-auction floor", async () => {
  const { raFloor } = await import("../lib/gemFields.js");
  assert.deepEqual(raFloor({ cost: 100000, minMargin: 3, quote: 112000 }), { floor: 103000, room: 9000, roomPct: 8 });
  assert.equal(raFloor({ cost: 0 }), null);
});
