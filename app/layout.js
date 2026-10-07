import "./globals.css";

export const metadata = {
  title: "Dhandha — Business Generation Suite",
  description: "Tenders, leads, CRM, outreach and content in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
