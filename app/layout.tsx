import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First and Last Goal Sweep",
  description: "Digital minute-sweepstake fundraising for football clubs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pitchDark text-chalk font-sans">{children}</body>
    </html>
  );
}
