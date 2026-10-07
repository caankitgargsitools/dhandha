export const metadata = {
  title: "Dhandha — Business Generation Suite",
  description: "Tenders, leads, CRM, outreach and content in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
