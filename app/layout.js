import { Hind_Siliguri, Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import LanguageToggle from "@/lib/LanguageToggle";
import BottomNav from "@/components/ui/BottomNav";

const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata = {
  title: "Gram Ride",
  description: "Rural ride-sharing app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${hind.variable} ${manrope.variable} antialiased`}>
        <LanguageProvider>
          <LanguageToggle />
          {children}
          <BottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}