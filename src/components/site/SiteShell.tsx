import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import { AppFrame } from "@/components/AppFrame";
import { BrowseSelectionProvider } from "@/components/BrowseSelection";
import { CollectionProvider } from "@/components/CollectionProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ServiceWorkerRegister } from "@/components/OfflineSupport";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { REVEAL_BOOT_SCRIPT } from "@/components/public-site/reveal-boot";
import { PREFERENCES_STORAGE_KEY } from "@/lib/preferences";

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

export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable}`;

export const siteViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eef6" },
    { media: "(prefers-color-scheme: dark)", color: "#07080d" },
  ],
  width: "device-width",
  initialScale: 1,
  // Plein écran sur iPhone (encoche, barre d'accueil) : les marges viennent de env(safe-area-inset-*).
  viewportFit: "cover",
  // Android : le clavier réduit la mise en page au lieu de recouvrir les formulaires.
  interactiveWidget: "resizes-content",
};

const themeBootScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});var theme="dark";if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.theme==="light")theme="light";}document.documentElement.setAttribute("data-theme",theme);document.documentElement.style.colorScheme=theme;}catch(e){}})();`;

/** Document HTML commun aux deux mises en page racines (français sans préfixe, anglais sous /en). */
export function SiteShell({ lang, children }: { lang: "fr" | "en"; children: ReactNode }) {
  return (
    <html lang={lang} className={`${fontVariables} h-dvh overflow-hidden antialiased`} data-theme="dark" suppressHydrationWarning>
      {/* Mise en page racine (App Router) : <head> est attendu ici, la règle vise le routeur Pages. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript + REVEAL_BOOT_SCRIPT }} />
      </head>
      <body className="h-dvh overflow-clip">
        <LocaleProvider>
          <PreferencesProvider>
            <CollectionProvider>
              <WishlistProvider>
                <BrowseSelectionProvider>
                  <AppFrame>{children}</AppFrame>
                </BrowseSelectionProvider>
              </WishlistProvider>
            </CollectionProvider>
          </PreferencesProvider>
        </LocaleProvider>
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
