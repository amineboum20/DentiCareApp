import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Suivi de commande · OptiApp",
  description: "Suivez l'état de votre commande en temps réel.",
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} antialiased`}>
      <body className="min-h-screen bg-zinc-50 font-sans">
        {children}
      </body>
    </html>
  );
}
