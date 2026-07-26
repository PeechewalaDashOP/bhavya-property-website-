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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded as non-render-blocking: media="print" makes the browser fetch
            it at low priority without blocking first paint, then the inline
            script flips media to "all" once it's actually loaded. This was
            the single biggest LCP cost on this page — a synchronous
            cross-origin stylesheet fetch was gating first paint on every
            load. Family names are unchanged, so globals.css needs no edits. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('link[media=\"print\"][rel=\"stylesheet\"]')" +
              ".forEach(function(l){l.addEventListener('load',function(){this.media='all';});});",
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
          />
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
