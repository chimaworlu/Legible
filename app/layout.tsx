import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { JsonLd } from "../src/components/seo/JsonLd";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://legible.app";

// Self-hosted at build time (served from our own origin) instead of a CSS
// @import to Google's CDN, which can silently fail to load in some browsers
// (ad blockers, corporate networks, etc.) and falls back to a default serif.
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#00B407",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Legible | Transform Handwritten Notes into Structured Digital Books",
    template: "%s | Legible",
  },
  description:
    "Turn photos of handwritten student notes into clean, structured digital books. AI vision transcription, automatic topic grouping, editable chapters, and PDF export for students and self-learners.",
  keywords: [
    "handwritten notes to digital book",
    "AI handwriting OCR",
    "study note organizer",
    "convert handwritten notes to PDF",
    "AI notebook scanner",
    "student study tool",
    "transcribe handwritten notes",
    "handwriting scanner Nigeria",
  ],
  authors: [{ name: "Legible Team" }],
  creator: "Legible",
  publisher: "Legible",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Legible",
    title: "Legible | Transform Handwritten Notes into Structured Digital Books",
    description:
      "Upload photos of handwritten notes. Get back an organized, structured digital book ready to read, edit, and export to PDF.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Legible — handwritten notes turned into a structured digital book",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legible | Transform Handwritten Notes into Structured Digital Books",
    description:
      "Upload photos of handwritten notes. Get back an organized, structured digital book ready to read, edit, and export to PDF.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={bricolageGrotesque.className}>
      <head>
        <JsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
