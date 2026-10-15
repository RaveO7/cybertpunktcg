import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/paths";
import { translatorFor } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

/** Pages légales : textes du bloc legal, une clé par page (même nom que la route publique). */
export type LegalPageKey = "legalNotice" | "terms" | "privacy";

type Block = string | { list: string[] };
type LegalContent = { title: string; description: string; sections: { title: string; blocks: Block[] }[] };

const VALUES = {
  site: SITE.name,
  publisher: SITE.publisher,
  hostName: SITE.host.name,
  hostAddress: SITE.host.address,
  hostDomain: SITE.host.url.replace(/^https?:\/\//, ""),
};

export async function legalMetadata(locale: Locale, page: LegalPageKey): Promise<Metadata> {
  const t = await translatorFor(locale, "legal");
  return pageMetadata({
    locale,
    page: { key: page },
    title: t(`${page}.title`),
    description: t(`${page}.description`, { site: SITE.name }),
  });
}

/**
 * Page légale dans la langue de la page. La version française fait foi : les autres versions le
 * signalent, avec un lien vers elle.
 */
export async function LegalPage({ locale, page }: { locale: Locale; page: LegalPageKey }) {
  const t = await getTranslations({ locale, namespace: "legal" });
  const format = await getFormatter({ locale });
  const content = t.raw(page as never) as LegalContent;
  const contact = SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : <>{t("contactFallback")}</>;
  const tags = {
    contact: () => contact,
    host: (chunks: ReactNode) => <a href={SITE.host.url}>{chunks}</a>,
    cnil: (chunks: ReactNode) => <a href="https://www.cnil.fr">{chunks}</a>,
    privacy: (chunks: ReactNode) => <Link href="/confidentialite">{chunks}</Link>,
    strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
    french: (chunks: ReactNode) => (
      <NextLink href={localizedPath(page, DEFAULT_LOCALE)} hrefLang={DEFAULT_LOCALE}>
        {chunks}
      </NextLink>
    ),
  };
  // Clés construites depuis la structure du bloc (sections, paragraphes, listes) : hors du typage des clés.
  const richText = t.rich as unknown as (key: string, values: Record<string, unknown>) => ReactNode;
  const rich = (key: string) => richText(key, { ...VALUES, ...tags });

  return (
    <article lang={locale} className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{SITE.name.toUpperCase()}</p>
      <h1 className="mt-1 font-display text-2xl text-yellow">{content.title}</h1>
      <p className="mt-1 text-xs text-muted">{t("updated", { date: format.dateTime(new Date(SITE.legalUpdatedAt), { dateStyle: "long" }) })}</p>
      {locale !== DEFAULT_LOCALE ? (
        <p className="mt-4 border border-line bg-panel px-3 py-2 text-sm text-muted [&_a]:text-cyan [&_a:hover]:underline">
          {rich("frenchPrevails")}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">
        {content.sections.map((section, sectionIndex) => (
          <section key={sectionIndex} className="flex flex-col gap-2">
            <h2 className="font-display text-base text-foreground">{section.title}</h2>
            <div className="flex flex-col gap-2 text-muted [&_a]:text-cyan [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5">
              {section.blocks.map((block, blockIndex) => {
                const key = `${page}.sections.${sectionIndex}.blocks.${blockIndex}`;
                return typeof block === "string" ? (
                  <p key={blockIndex}>{rich(key)}</p>
                ) : (
                  <ul key={blockIndex}>
                    {block.list.map((_, itemIndex) => (
                      <li key={itemIndex}>{rich(`${key}.list.${itemIndex}`)}</li>
                    ))}
                  </ul>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
