// Makes Dhandha installable as a phone app (Chrome on Android: "Install app" / "Add to home screen").
export default function manifest() {
  return {
    name: "Dhandha — Business Generation Suite",
    short_name: "Dhandha",
    description: "Tenders, leads, CRM and outreach for your business.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tenders", url: "/app/tenders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Follow-ups due", url: "/app/leads?tab=due", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
