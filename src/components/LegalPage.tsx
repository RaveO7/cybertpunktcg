"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { SITE } from "@/lib/site";

/** Gabarit des pages légales (texte en français uniquement). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const { locale, t } = useI18n();
  return (
    <article lang="fr" className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{SITE.name.toUpperCase()}</p>
      <h1 className="mt-1 font-display text-2xl text-yellow">{title}</h1>
      <p className="mt-1 text-xs text-muted">Dernière mise à jour : {SITE.legalUpdatedAt}</p>
      {locale !== "fr" ? (
        <p lang={locale} className="mt-4 border border-line bg-panel px-3 py-2 text-sm text-muted">
          {t.footer.legalOnlyFrench}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-base text-foreground">{title}</h2>
      <div className="flex flex-col gap-2 text-muted [&_a]:text-cyan [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** Moyen de contact cité dans les pages légales. */
export function LegalContact() {
  return SITE.contactEmail ? (
    <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
  ) : (
    <>les réseaux sociaux indiqués en pied de page</>
  );
}
