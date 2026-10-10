import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import HoldSweeper from "@/components/HoldSweeper";

export const metadata: Metadata = {
  title: "24/7 Rentals & Tours",
  description: "Book a vehicle, a 6-hour day tour or a long-term tour. Pay the deposit by GCash or bank transfer.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ea580c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Nav />
        <HoldSweeper />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-400">
          Demo build (Stage 2): bookings are saved in this browser only. No real payments or texts are sent.
        </footer>
      </body>
    </html>
  );
}
