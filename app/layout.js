import { Hind_Siliguri, Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import BottomNav from "@/components/ui/BottomNav";
import PinGate from "@/components/PinGate";
import SplashScreen from '@/components/ui/SplashScreen'

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
  title: "GramJatra",
  description: "Rural ride-sharing app",
  applicationName: "GramJatra",
  appleWebApp: {
    capable: true,
    title: "GramJatra",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#00875A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${hind.variable} ${manrope.variable} antialiased`}>
        <LanguageProvider>
          <SplashScreen />
          {children}
          <BottomNav />
          <PinGate />
        </LanguageProvider>
      </body>
    </html>
  );
}