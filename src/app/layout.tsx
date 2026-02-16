import type { Metadata } from "next";
import "./globals.css";
import { PwaStandaloneDetector } from "./PwaStandaloneDetector";

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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-full.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PwaStandaloneDetector />
        <div className="app-outer">
          <div className="app-phone">{children}</div>
        </div>
      </body>
    </html>
  );
}
