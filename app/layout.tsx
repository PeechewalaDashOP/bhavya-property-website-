import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prop100 — Buy, Rent & Sell Property in Kota",
  description:
    "Verified houses, flats, plots and rentals across Kota — Talwandi, Vigyan Nagar, Mahaveer Nagar, Dadabadi and more. Direct from trusted dealers, free to browse & contact.",
  keywords: [
    "property in Kota", "flats in Kota", "houses for sale Kota", "rent in Kota",
    "plots in Kota", "Talwandi", "Vigyan Nagar", "real estate Kota Rajasthan"
  ],
  openGraph: {
    title: "Prop100 — Buy, Rent & Sell Property in Kota",
    description: "Verified homes across Kota, direct from trusted dealers.",
    type: "website"
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
