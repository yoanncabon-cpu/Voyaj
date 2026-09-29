import type { Metadata, Viewport } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./motion.css";
import "./signup.css";
import "./journey.css";
import MotionControls from "@/components/MotionControls";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-poppins",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Voyaj — Le covoiturage instantané pour tous les Jo",
  description:
    "Voyaj relie en temps réel les conducteurs qui prennent la route et ceux qui vont dans la même direction. Les frais sont partagés, simplement.",
  openGraph: {
    title: "Voyaj — Le covoiturage instantané",
    description: "Les voitures roulent déjà. Il suffit de monter.",
  },
};

export const viewport: Viewport = { themeColor: "#15162A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${mono.variable}`}>
      <body>{children}<MotionControls /></body>
    </html>
  );
}
