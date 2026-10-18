import type { Metadata } from "next";
import { BootScript } from "@/components/site/BootScript";
import { GlobalFallback } from "@/components/site/GlobalFallback";
import { fontVariables } from "@/components/site/SiteShell";
import { PREFERENCES_STORAGE_KEY } from "@/lib/preferences";
import "./globals.css";

// URL sans aucune route : rendu hors de la mise en page racine. Le titre et le texte suivent la
// langue de l'URL (cf. GlobalFallback).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const themeBootScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.theme==="light")document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`;

export default function GlobalNotFound() {
  return (
    <html lang="fr" className={`${fontVariables} antialiased`} data-theme="dark" suppressHydrationWarning>
      <head>
        <BootScript html={themeBootScript} />
      </head>
      <body className="min-h-dvh">
        <GlobalFallback kind="notFound" />
      </body>
    </html>
  );
}
