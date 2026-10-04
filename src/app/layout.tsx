import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import { AppFrame } from "@/components/AppFrame";
import { BrowseSelectionProvider } from "@/components/BrowseSelection";
import { CollectionProvider } from "@/components/CollectionProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { PREFERENCES_STORAGE_KEY } from "@/lib/preferences";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Collection Cyberpunk TCG",
  description: "Consultez les cartes officielles et gérez votre collection Cyberpunk TCG.",
  applicationName: "Collection Cyberpunk TCG",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eef6" },
    { media: "(prefers-color-scheme: dark)", color: "#07080d" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeBootScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});var theme="dark";if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.theme==="light")theme="light";}document.documentElement.setAttribute("data-theme",theme);document.documentElement.style.colorScheme=theme;}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-dvh overflow-hidden antialiased`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="h-dvh overflow-clip">
        <LocaleProvider>
          <PreferencesProvider>
            <CollectionProvider>
              <BrowseSelectionProvider>
                <AppFrame>{children}</AppFrame>
              </BrowseSelectionProvider>
            </CollectionProvider>
          </PreferencesProvider>
        </LocaleProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
