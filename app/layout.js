import "@fontsource-variable/inter";
import "@fontsource/tiro-devanagari-hindi/devanagari-400.css";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import ActivityBar from "@/components/ActivityBar";

export const metadata = {
  title: "Dhandha — Business Generation Suite",
  description: "Tenders, leads, CRM, outreach and content in one place.",
  applicationName: "Dhandha",
  appleWebApp: { capable: true, title: "Dhandha", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-180.png" },
};

export const viewport = { themeColor: "#4f46e5", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><ActivityBar />{children}<PwaRegister /></body>
    </html>
  );
}
