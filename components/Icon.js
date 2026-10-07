// Small line-icon set (24px grid, 1.8 stroke), drawn for Dhandha.
const P = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  vault: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="12" cy="12" r="3.2" /><path d="M12 8.8V7M12 17v-1.8M15.2 12H17M7 12h1.8" /></>,
  doc: <><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4" /><path d="M9 12h6M9 15.5h6" /></>,
  facts: <><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16.5" r="3" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5h6v2M3.5 12.5h17" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.3" /></>,
  pen: <><path d="M4 20c3-1 4.5-3.2 6-6s3.5-6.5 7-9" /><path d="M14 5.5l4.5 4" /><path d="M3.5 20.5h17" /></>,
  tender: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M8.5 11h7M8.5 14.5h5" /><circle cx="16.5" cy="17.5" r="3" fill="currentColor" stroke="none" opacity=".25" /><path d="m15.2 17.6 1 1 2-2.1" /></>,
  leads: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /><path d="M11 8v6M8 11h6" /></>,
  crm: <><rect x="3.5" y="4.5" width="5" height="15" rx="1.5" /><rect x="10" y="4.5" width="5" height="10" rx="1.5" /><rect x="16.5" y="4.5" width="4" height="6.5" rx="1.5" /></>,
  content: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m10 9.5 5 2.8-5 2.8z" /></>,
  wallet: <><path d="M4 7.5h14.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 18z" /><path d="M4 7.5 15 4.5v3" /><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" /></>,
  shield: <><path d="M12 3.5 19 6v6c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  building: <><path d="M4.5 20.5V5.5l8-2v17M12.5 8.5h7v12" /><path d="M7.5 8h2M7.5 11.5h2M7.5 15h2M15.5 12h1M15.5 15.5h1" /><path d="M3 20.5h18" /></>,
  log: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  ticket: <><path d="M3.5 8.5V6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" /><path d="M14.5 5.5v11" strokeDasharray="2 2" /></>,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.2 1.6M17.6 15.9l2.2 1.6M2.5 12h3M18.5 12h3M4.2 17.5l2.2-1.6M17.6 8.1l2.2-1.6" /></>,
  rupee: <><path d="M7 4.5h10M7 9h10M7 4.5c5.5 0 6.5 9-1 9l7.5 7" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  cross: <><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></>,
  alert: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17v.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  logout: <><path d="M14 4.5h4.5v15H14" /><path d="M10 8 6 12l4 4M6 12h9" /></>,
  sparkle: <><path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2z" /></>,
  phone: <><path d="M5 4.5h3.5l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5C10 20.5 3.5 14 3.5 6A1.5 1.5 0 0 1 5 4.5z" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 6.5 8 6 8-6" /></>,
  map: <><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
};

export default function Icon({ name, size = 18, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {P[name] || P.doc}
    </svg>
  );
}
