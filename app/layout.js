import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "@fontsource/tiro-devanagari-hindi/devanagari-400.css";
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
