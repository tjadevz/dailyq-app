import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
