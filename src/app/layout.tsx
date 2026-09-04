import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://kolo-app-chi.vercel.app";
const TAGLINE = "Save in circles. Know what's yours to spend.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Braid",
  description: TAGLINE,
  openGraph: {
    title: "Braid",
    description: TAGLINE,
    siteName: "Braid",
    url: SITE_URL,
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "Braid" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Braid",
    description: TAGLINE,
    images: ["/og-card.png"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0c14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Braid" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
