"use client";

import Link from "next/link";
import { useI18n } from "@/components/LocaleProvider";
import { LEGAL_LINKS, SITE, SOCIAL_LINKS, type SocialNetwork } from "@/lib/site";

/** Pied de page : liens légaux et réseaux sociaux. */
export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto shrink-0 border-t border-line" aria-label={t.footer.label}>
      {/* Une seule ligne : liens légaux à gauche, copyright au centre, réseaux à droite (empilés sur téléphone). */}
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-2 px-4 py-3 text-xs text-muted md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:justify-start">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="py-1 hover:text-foreground">
              {t.footer[link.key]}
            </Link>
          ))}
        </nav>
        <p className="font-mono tracking-[0.12em]">
          © {new Date().getFullYear()} {SITE.name}
        </p>
        <ul className="flex items-center gap-1 md:justify-self-end" aria-label={t.footer.social}>
          {SOCIAL_LINKS.map((link) => (
            <li key={link.network}>
              {link.href ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-9 items-center justify-center border border-transparent hover:border-cyan hover:text-foreground"
                  aria-label={link.label}
                  title={link.label}
                >
                  <SocialGlyph network={link.network} />
                </a>
              ) : (
                // Réseau sans URL renseignée dans src/lib/site.ts : icône affichée, non cliquable.
                <span className="inline-flex size-9 items-center justify-center opacity-60" title={link.label}>
                  <SocialGlyph network={link.network} />
                  <span className="sr-only">{link.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

function SocialGlyph({ network }: { network: SocialNetwork }) {
  const common = {
    "aria-hidden": true,
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  switch (network) {
    case "discord":
      return (
        <svg {...common}>
          <path d="M8.5 5.5c-1.6.3-3 .8-4.2 1.6C2.6 10 2 13 2.3 16.5c1.4 1.1 3 1.8 4.6 2.2l1.1-1.8M15.5 5.5c1.6.3 3 .8 4.2 1.6 1.7 2.9 2.3 5.9 2 9.4-1.4 1.1-3 1.8-4.6 2.2l-1.1-1.8" />
          <path d="M7 16c3.2 1.4 6.8 1.4 10 0M8 7c2.6-.8 5.4-.8 8 0" />
          <circle cx="9" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M4 4l16 16M20 4l-6.6 7.1M10.6 12.9 4 20" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
          <path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M13 3.5v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M13 3.5c.4 2.6 2.3 4.5 5 4.7" />
        </svg>
      );
    case "bluesky":
      return (
        <svg {...common}>
          <path d="M12 11c-1.5-3-4.6-6-7-6.4-1.3-.2-1.5 1-1.5 2.3 0 1.8.6 4.5 2.5 5.1 1.4.5 2.8.3 3.5.1-2.3.6-3.9 2-2.5 3.8 2.2 2.6 4 .3 5-2.6 1 2.9 2.8 5.2 5 2.6 1.4-1.8-.2-3.2-2.5-3.8.7.2 2.1.4 3.5-.1 1.9-.6 2.5-3.3 2.5-5.1 0-1.3-.2-2.5-1.5-2.3-2.4.4-5.5 3.4-7 6.4z" />
        </svg>
      );
  }
}
