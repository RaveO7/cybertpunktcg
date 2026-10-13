// Images de partage (Open Graph, 1200×630) générées à la demande : par défaut, tournoi, boutique.

import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/seo/metadata";
import { COPY } from "@/lib/seo/copy";
import type { SiteLocale } from "@/lib/seo/routes";

export const OG_SIZE = { width: 1200, height: 630 };

const COLORS = { background: "#07080d", yellow: "#f5e642", cyan: "#3ee0ff", text: "#e8eef7", muted: "#93a0b4", line: "#1f2633" };

/** Mise en cache CDN : l'image change rarement, une heure de retard est acceptable. */
const CACHE_HEADERS = { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" };

export function isSiteLocale(value: string): value is SiteLocale {
  return value === "fr" || value === "en";
}

export function ogImage({
  eyebrow,
  title,
  lines = [],
  logo = null,
}: {
  eyebrow: string;
  title: string;
  lines?: string[];
  /** Image en data URI (PNG), affichée à droite. */
  logo?: string | null;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: COLORS.background,
          color: COLORS.text,
          borderLeft: `16px solid ${COLORS.yellow}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: COLORS.cyan, textTransform: "uppercase" }}>{eyebrow}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
            <div style={{ display: "flex", fontSize: title.length > 40 ? 60 : 76, fontWeight: 700, lineHeight: 1.05, color: COLORS.yellow }}>{title}</div>
            {lines.map((line) => (
              <div key={line} style={{ display: "flex", fontSize: 34, color: COLORS.text }}>
                {line}
              </div>
            ))}
          </div>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- rendu par Satori, pas par le navigateur
            <img src={logo} alt="" width={220} height={220} style={{ border: `2px solid ${COLORS.line}` }} />
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: COLORS.muted }}>
          <span>{BRAND}</span>
          <span>Cyberpunk TCG</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, headers: CACHE_HEADERS },
  );
}

export function defaultOgImage(locale: SiteLocale) {
  return ogImage({ eyebrow: "Cyberpunk TCG", title: BRAND, lines: [COPY[locale].og.tagline] });
}
