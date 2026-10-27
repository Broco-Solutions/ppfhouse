import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { brandConfig } from "@/config/brand";

import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "../design-system/fonts/inter-latin-wght-normal.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "../design-system/fonts/inter-latin-wght-italic.woff2",
      style: "italic",
      weight: "100 900",
    },
  ],
  display: "swap",
  fallback: ["Segoe UI", "Helvetica", "Arial", "sans-serif"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: brandConfig.productName,
    template: `%s · ${brandConfig.productName}`,
  },
  description: "Gestión interna de Ferraro Detail.",
  icons: { icon: brandConfig.assets.mark },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brandConfig.theme.themeColor,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.variable} lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
