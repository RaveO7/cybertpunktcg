import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbLd, type Crumb } from "@/lib/seo/structured-data";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/paths";

/**
 * Fil d'Ariane visible et son équivalent JSON-LD (mêmes données). L'accueil est ajouté en tête ;
 * le dernier élément est la page courante.
 */
export async function Breadcrumbs({ locale, items }: { locale: Locale; items: Crumb[] }) {
  const t = await getTranslations({ locale, namespace: "nav.breadcrumb" });
  const crumbs: Crumb[] = [{ name: t("home"), path: localizedPath("home", locale) }, ...items];
  return (
    <>
      <nav aria-label={t("label")} className="mx-auto w-full max-w-5xl px-4 pt-3 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.path} className="flex min-w-0 items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="truncate text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.path} className="hover:text-foreground">
                      {crumb.name}
                    </Link>
                    <span aria-hidden="true">›</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={[breadcrumbLd(crumbs)]} />
    </>
  );
}
