// Portals crawled by Dhandha. GePNIC (NIC e-Procurement) sites share one adapter.
// Verify each base URL on the first run; the health log flags any site that returns nothing.
export const GEPNIC = [
  { portal: "CPPP Central e-Tenders", state: null, base: "https://etenders.gov.in/eprocure/app" },
  { portal: "Defence e-Procurement", state: null, base: "https://defproc.gov.in/nicgep/app" },
  { portal: "Haryana e-Procurement", state: "Haryana", base: "https://etenders.hry.nic.in/nicgep/app" },
  { portal: "Delhi e-Procurement", state: "Delhi", base: "https://govtprocurement.delhi.gov.in/nicgep/app" },
  { portal: "UP e-Tender", state: "Uttar Pradesh", base: "https://etender.up.nic.in/nicgep/app" },
  { portal: "Punjab e-Procurement", state: "Punjab", base: "https://eproc.punjab.gov.in/nicgep/app" },
  { portal: "Maharashtra e-Tender", state: "Maharashtra", base: "https://mahatenders.gov.in/nicgep/app" },
  { portal: "MP e-Tender", state: "Madhya Pradesh", base: "https://mptenders.gov.in/nicgep/app" },
  { portal: "Rajasthan e-Procurement", state: "Rajasthan", base: "https://eproc.rajasthan.gov.in/nicgep/app" },
  { portal: "Uttarakhand e-Tender", state: "Uttarakhand", base: "https://uktenders.gov.in/nicgep/app" },
  { portal: "Himachal e-Tender", state: "Himachal Pradesh", base: "https://hptenders.gov.in/nicgep/app" },
  { portal: "J&K e-Tender", state: "Jammu and Kashmir", base: "https://jktenders.gov.in/nicgep/app" },
  { portal: "West Bengal e-Tender", state: "West Bengal", base: "https://wbtenders.gov.in/nicgep/app" },
  { portal: "Odisha e-Tender", state: "Odisha", base: "https://tendersodisha.gov.in/nicgep/app" },
  { portal: "Tamil Nadu e-Tender", state: "Tamil Nadu", base: "https://tntenders.gov.in/nicgep/app" },
  { portal: "Kerala e-Tender", state: "Kerala", base: "https://etenders.kerala.gov.in/nicgep/app" },
  { portal: "Bihar e-Procurement", state: "Bihar", base: "https://eproc2.bihar.gov.in/EPSV2Web/" , skip: true },
  { portal: "Jharkhand e-Tender", state: "Jharkhand", base: "https://jharkhandtenders.gov.in/nicgep/app" },
  { portal: "Goa e-Procurement", state: "Goa", base: "https://eprocure.goa.gov.in/nicgep/app" },
  { portal: "Assam e-Procurement", state: "Assam", base: "https://assamtenders.gov.in/nicgep/app" },
  // added 28 Oct after checks from the Mumbai server (Manipur refuses visitors; Chhattisgarh runs its own system)
  { portal: "Meghalaya e-Tender", state: "Meghalaya", base: "https://meghalayatenders.gov.in/nicgep/app" },
  { portal: "Mizoram e-Tender", state: "Mizoram", base: "https://mizoramtenders.gov.in/nicgep/app" },
  { portal: "Nagaland e-Tender", state: "Nagaland", base: "https://nagalandtenders.gov.in/nicgep/app" },
  { portal: "Sikkim e-Tender", state: "Sikkim", base: "https://sikkimtender.gov.in/nicgep/app" },
  { portal: "Tripura e-Tender", state: "Tripura", base: "https://tripuratenders.gov.in/nicgep/app" },
  { portal: "Arunachal e-Tender", state: "Arunachal Pradesh", base: "https://arunachaltenders.gov.in/nicgep/app" },
  { portal: "Chandigarh e-Tender", state: "Chandigarh", base: "https://etenders.chd.nic.in/nicgep/app" },
  { portal: "Puducherry e-Tender", state: "Puducherry", base: "https://pudutenders.gov.in/nicgep/app" },
  { portal: "Ladakh e-Tender", state: "Ladakh", base: "https://tenders.ladakh.gov.in/nicgep/app" },
  // public-sector companies on GePNIC (all-India; the state comes from each tender's organisation)
  { portal: "Indian Oil (IOCL)", state: null, base: "https://iocletenders.nic.in/nicgep/app" },
  { portal: "Coal India", state: null, base: "https://coalindiatenders.nic.in/nicgep/app" },
  { portal: "BHEL", state: null, base: "https://eprocurebhel.co.in/nicgep/app" },
];

export const GEM = { portal: "GeM", base: "https://bidplus.gem.gov.in" };
