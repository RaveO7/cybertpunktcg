import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/components/site/SiteShell";
import { PREFERENCES_STORAGE_KEY } from "@/lib/preferences";
import "./globals.css";

// URL sans aucune route : rendu hors des mises en page racines (fr / en), d'où le texte bilingue.
export const metadata: Metadata = {
  title: "Page introuvable · TCG Tracker",
  robots: { index: false, follow: false },
};

const themeBootScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});if(raw){var parsed=JSON.parse(raw);if(parsed&&parsed.theme==="light")document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`;

export default function GlobalNotFound() {
  return (
    <html lang="fr" className={`${fontVariables} antialiased`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh">
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="font-mono text-xs tracking-[0.18em] text-cyan">404</p>
          <h1 className="mt-1 text-2xl text-yellow">Page introuvable</h1>
          <p className="mt-2 text-sm text-muted">Cette adresse ne correspond à aucune page. This page does not exist.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground">
              Accueil
            </Link>
            <Link href="/en" className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground">
              Home (English)
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
