import Link from "next/link";
import { JsonLd } from "@/components/site/JsonLd";
import { COPY } from "@/lib/seo/copy";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { breadcrumbLd, type Crumb } from "@/lib/seo/structured-data";

/**
 * Fil d'Ariane visible et son équivalent JSON-LD (mêmes données). L'accueil est ajouté en tête ;
 * le dernier élément est la page courante.
 */
export function Breadcrumbs({ locale, items }: { locale: SiteLocale; items: Crumb[] }) {
  const copy = COPY[locale].breadcrumb;
  const crumbs: Crumb[] = [{ name: copy.home, path: localizedPath("home", locale) }, ...items];
  return (
    <>
      <nav aria-label={copy.label} className="mx-auto w-full max-w-5xl px-4 pt-3 text-xs text-muted">
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
