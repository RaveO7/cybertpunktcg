"use client";

import { startTransition, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { getPathname, useRouter } from "@/i18n/navigation";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection, whenIdle } from "@/components/CollectionProvider";
import { TrendBadge } from "@/components/TrendBadge";
import { BlockGrid } from "@/components/dashboard/BlockGrid";
import {
  LANGUAGES,
  buildDashboardView,
  cardsHref,
  languageFor,
  matchesSet,
  sumProgress,
  type Block,
  type BlockPick,
  type CatalogMode,
  type Extension,
  type Language,
  type Scope,
  type SortKey,
} from "@/components/dashboard/model";
import { ScopeDetail } from "@/components/dashboard/ScopeDetail";
import { EmptyCatalog, GlobalStat, ProgressRing, SearchIcon, SegmentButton, SegmentGroup } from "@/components/dashboard/ui";
import { ValueBySet } from "@/components/dashboard/ValueBySet";
import { ScreenError, ScreenSkeleton, SkeletonBlock } from "@/components/site/ScreenSkeleton";
import { intlLocale } from "@/i18n/config";
import { ALL_SETS_ID, BETA_SET_CODE, isSealedSetCode } from "@/lib/reference-data";

export function Dashboard() {
  const fmt = useNumberFormat();
  const { ready, error, retry, catalog, items } = useCollection();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { selection, setSelection } = useBrowseSelection();
  const numberLocale = intlLocale(locale);
  const [mode, setMode] = useState<CatalogMode>(() => (isSealedSetCode(selection.set) ? "sealed" : "cards"));
  const [language, setLanguage] = useState<Language>(() => languageFor(selection.language));
  const [sort, setSort] = useState<SortKey>("catalog");
  // Au chargement, rien n'est sélectionné : l'en-tête cumule tous les blocs.
  const [selectedKey, setSelectedKey] = useState<Record<CatalogMode, string>>({
    cards: "",
    sealed: "",
  });
  const [pick, setPick] = useState<BlockPick | null>(null);
  const isDesktop = useIsDesktop();
  const showValues = useAfterFirstPaint(ready && Boolean(catalog));

  // En attendant les données : formats de nombres préparés au repos (coûteux au premier usage).
  useEffect(() => {
    if (ready) return;
    return whenIdle(() => {
      fmt.money(0);
      fmt.int(0);
      fmt.percent(0);
    });
  }, [ready, fmt]);

  const view = useMemo(() => {
    if (!catalog) return null;
    return buildDashboardView(catalog, items, language, t("dashboard.unsortedBlock"));
  }, [catalog, items, language, t]);

  const isSealed = mode === "sealed";
  const gridItems: (Block | Extension)[] = view ? (isSealed ? view.sealedExtensions : view.blocks) : [];
  const wanted = selectedKey[mode];
  const current: Block | Extension | null =
    (!wanted
      ? null
      : isSealed
        ? view?.sealedExtensions.find((entry) => entry.key === wanted)
        : view?.blocks.find(
            (entry) =>
              entry.key === wanted ||
              entry.browseSet === wanted ||
              entry.extensions.some((extension) => matchesSet(extension, wanted)),
          )) ??
    // Un seul bloc (grille masquée) : il est forcément sélectionné.
    (!isSealed && gridItems.length === 1 ? gridItems[0] : null);
  const block = current && "extensions" in current ? current : null;

  // Dans un bloc : 1er clic = progression à côté, 2e clic sur la même ligne = page Cartes.
  const pickedExtension =
    block && pick?.block === block.key
      ? (block.extensions.find((extension) => extension.key === pick.extension) ?? null)
      : null;
  const scope: Scope | null = pickedExtension ?? current;

  const scopeSet = scope?.browseSet;
  const scopeLanguage = scope?.language;
  useEffect(() => {
    if (!scopeSet || !scopeLanguage) return;
    setSelection({ set: scopeSet, language: scopeLanguage });
  }, [scopeSet, scopeLanguage, setSelection]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
        <ScreenError message={error} onRetry={retry} />
      </div>
    );
  }
  // Premier chargement : squelette du tableau de bord, jamais de « 0 carte » ni de valeur à 0 €.
  if (!ready || !view || !catalog) return <DashboardSkeleton />;
  if (catalog.printings.length === 0) return <EmptyCatalog />;

  const globalValue = isSealed ? view.sealedValue : view.cardValue;
  // L'en-tête suit la sélection : bloc entier, extension ou impression (ou catégorie scellée).
  const heroProgress = scope?.progress ?? sumProgress(gridItems.map((entry) => entry.progress));
  const heroValue = scope ? scope.value : globalValue;
  const heroSet = scope?.browseSet ?? (isSealed ? "" : ALL_SETS_ID);
  const heroLanguage = scope?.language ?? language;
  const heroTitle =
    pickedExtension?.shortName ?? scope?.name ?? (isSealed ? t("dashboard.sealed") : t("dashboard.allSetsTitle"));
  const blockExtensionCount = block?.extensions.filter((extension) => !extension.related).length ?? 0;
  const heroIntro = isSealed
    ? scope
      ? t("dashboard.sealedProductsHint", { n: fmt.int(scope.printings.length) })
      : t("dashboard.sealedIntro")
    : pickedExtension
      ? t("dashboard.extensionIntro", { n: fmt.int(pickedExtension.progress.total) })
      : [
          t("dashboard.globalIntro", { n: fmt.int(blockExtensionCount), noun: t("dashboard.extensionNoun", { n: blockExtensionCount }) }),
          block?.extensions.some((extension) => extension.codes.includes(BETA_SET_CODE)) ? t("dashboard.splitNote") : null,
        ]
          .filter(Boolean)
          .join(" ");
  // Tri par valeur, la ligne « autres » toujours en dernier.
  const valueRows = [...(isSealed ? view.sealedValueRows : view.cardValueRows)].sort(
    (a, b) => Number(a.name == null) - Number(b.name == null) || b.value.marketTotal - a.value.marketTotal,
  );
  const valueTotal = valueRows.reduce((sum, row) => sum + row.value.marketTotal, 0);
  const spentLine =
    view.spent.pricedLines > 0
      ? view.spent.totals
          .map(([currency, amount]) =>
            new Intl.NumberFormat(numberLocale, {
              style: "currency",
              currency,
            }).format(amount),
          )
          .join(", ")
      : null;

  // Re-cliquer la carte sélectionnée revient à la vue de tous les blocs.
  const selectItem = (entry: Block | Extension) => {
    setSelectedKey((prev) => ({
      ...prev,
      [mode]: prev[mode] === entry.key ? "" : entry.key,
    }));
    setPick(null);
  };
  const pickRow = (extension: Extension) => {
    if (!block) return;
    if (pickedExtension?.key === extension.key) {
      router.push(cardsHref({ set: extension.browseSet, language: extension.language }));
      return;
    }
    setPick({ block: block.key, extension: extension.key });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 sm:py-8">
      {/* 1. Vue globale */}
      <section className="hud-panel relative overflow-hidden">
        {/* Hauteur ≈ 90 % de l'arc du coin (rayon 11px), puis le jaune longe le haut. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 h-[9px] rounded-tl-[11px] border-l-2 border-t-2 border-yellow transition-[width] duration-700 ${
            heroProgress.percent >= 100 ? "rounded-tr-[11px] border-r-2" : ""
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, heroProgress.percent))}%`,
          }}
        />
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-5 sm:gap-6">
            <ProgressRing percent={heroProgress.percent} label={fmt.percent(heroProgress.percent)} />
            <div className="min-w-0">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
                {t("dashboard.eyebrow")}
                {current && scope !== current ? ` · ${current.name}` : null}
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{heroIntro}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:max-w-sm">
            <div className="flex flex-wrap gap-3">
              <SegmentGroup ariaLabel={t("dashboard.modeCards")} grow>
                <SegmentButton active={!isSealed} onClick={() => setMode("cards")}>
                  {t("dashboard.modeCards")}
                </SegmentButton>
                <SegmentButton active={isSealed} onClick={() => setMode("sealed")}>
                  {t("dashboard.modeSealed")}
                </SegmentButton>
              </SegmentGroup>
              <SegmentGroup ariaLabel={t("investment.language")}>
                {LANGUAGES.map((entry) => (
                  <SegmentButton
                    key={entry}
                    active={language === entry}
                    onClick={() => {
                      setLanguage(entry);
                      setPick(null);
                    }}
                  >
                    {entry.toUpperCase()}
                  </SegmentButton>
                ))}
              </SegmentGroup>
            </div>
            <form action={getPathname({ href: "/cards", locale })} className="flex">
              <input type="hidden" name="set" value={heroSet} />
              <input type="hidden" name="language" value={heroLanguage} />
              <label className="flex h-11 w-full items-center gap-2.5 border border-line bg-panel-2 px-3.5 text-muted focus-within:border-cyan">
                <SearchIcon />
                <span className="sr-only">{t("common.search")}</span>
                <input
                  name="q"
                  type="search"
                  placeholder={isSealed ? t("dashboard.sealedSearchPlaceholder") : t("dashboard.searchPlaceholder")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/80"
                />
              </label>
            </form>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line/60 xl:grid-cols-4">
          <GlobalStat label={isSealed ? t("dashboard.uniqueSealed") : t("dashboard.uniqueCards")}>
            <span className="font-mono text-2xl text-yellow sm:text-3xl">{fmt.int(heroProgress.uniqueOwned)}</span>
            <span className="font-mono text-sm text-muted">/ {fmt.int(heroProgress.total)}</span>
          </GlobalStat>
          <GlobalStat
            label={t("dashboard.missing")}
            href={cardsHref({
              set: heroSet,
              language: heroLanguage,
              collection: "missing",
            })}
            linkLabel={t("dashboard.see")}
            tone="danger"
          >
            <span className="font-mono text-2xl text-danger sm:text-3xl">{fmt.int(heroProgress.missing)}</span>
          </GlobalStat>
          <GlobalStat
            label={t("dashboard.duplicates")}
            href={cardsHref({
              set: heroSet,
              language: heroLanguage,
              collection: "duplicates",
            })}
            linkLabel={t("dashboard.see")}
          >
            <span className="font-mono text-2xl sm:text-3xl">{fmt.int(heroProgress.duplicates)}</span>
          </GlobalStat>
          <GlobalStat label={isSealed ? t("dashboard.sealedTrendValue") : t("dashboard.trendValue")} last>
            {view.hasPrices && heroValue && heroValue.pricedCopies > 0 ? (
              <>
                <span className="font-mono text-xl text-yellow sm:text-3xl">{fmt.money(heroValue.marketTotal)}</span>
                <TrendBadge delta={heroValue.marketDelta} amount={heroValue.marketDeltaAmount} />
              </>
            ) : (
              <span className="text-sm text-muted">{t("dashboard.noValue")}</span>
            )}
          </GlobalStat>
        </div>
        {spentLine ? (
          <p className="border-t border-line/60 px-5 py-3 text-sm text-muted sm:px-7">
            <span className="text-foreground/90">{t("dashboard.spent")}</span> · {spentLine}
          </p>
        ) : null}
      </section>

      {/* 2. Grille des blocs (ou des catégories scellées) — inutile s'il n'y a qu'un bloc */}
      <BlockGrid
        isSealed={isSealed}
        gridItems={gridItems}
        current={current}
        sort={sort}
        hasPrices={view.hasPrices}
        setSort={setSort}
        selectItem={selectItem}
      />

      {/* 3. Détail du bloc choisi */}
      {current && scope ? (
        <ScopeDetail
          current={current}
          scope={scope}
          block={block}
          pickedExtension={pickedExtension}
          isSealed={isSealed}
          hasPrices={view.hasPrices}
          items={items}
          setPick={setPick}
          pickRow={pickRow}
        />
      ) : null}

      {/* 4. Valeur par extension (en bas de page : rendue après le premier affichage) */}
      {showValues ? (
        <ValueBySet
          isSealed={isSealed}
          isDesktop={isDesktop}
          valueRows={valueRows}
          valueTotal={valueTotal}
          globalValue={globalValue}
        />
      ) : null}
    </div>
  );
}

/** Squelette du tableau de bord : en-tête et ses quatre chiffres, puis la grille des blocs. */
function DashboardSkeleton() {
  const t = useTranslations();
  return (
    <ScreenSkeleton
      label={t("dashboard.loading")}
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 sm:py-8"
    >
      <div className="flex flex-col gap-4 border border-line bg-panel p-4 sm:p-7">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-9 w-2/3 max-w-md" />
        <SkeletonBlock className="h-4 w-full max-w-xl" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-16" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="h-32" />
        ))}
      </div>
    </ScreenSkeleton>
  );
}

/** Point de rupture `md` de Tailwind : tableau sur ordinateur, liste sur téléphone. */
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Largeur ordinateur : une seule des deux mises en page est rendue (l'autre serait masquée en CSS). */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}

/**
 * Vrai une fois le tableau de bord affiché (`active`) : les sections sous la ligne de flottaison sont
 * rendues juste après, sans retarder le premier affichage.
 */
function useAfterFirstPaint(active: boolean) {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    if (!active || painted) return;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => startTransition(() => setPainted(true)));
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [active, painted]);
  return painted;
}
