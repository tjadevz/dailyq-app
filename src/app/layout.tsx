import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-logo",
});

export const metadata: Metadata = {
  title: "DailyQ",
  description: "Eén rustige vraag per dag.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className={nunito.variable}>{children}</body>
    </html>
  );
}
