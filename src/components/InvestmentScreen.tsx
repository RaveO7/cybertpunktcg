"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { useNumberFormat } from "@/i18n/number-format";
import type { ChartPurchase } from "@/components/PriceChart";
import { CardModal } from "@/components/CardModal";
import { useCollection } from "@/components/CollectionProvider";
import { attachPurchases, chartRangeStart, filterChartRange, type ChartRange } from "@/components/investment/chart-range";
import { InvestmentChart, chartRangeLabel } from "@/components/investment/InvestmentChart";
import { InvestmentFilters } from "@/components/investment/InvestmentFilters";
import { LineTable } from "@/components/investment/LineTable";
import { MoversPanel } from "@/components/investment/MoversPanel";
import { SalesTable } from "@/components/investment/SalesTable";
import { SellAlertDialog, SellDialog, type SellTarget } from "@/components/investment/SellDialogs";
import { SetTable } from "@/components/investment/SetTable";
import {
  lineProfitPct,
  sortPositionRows,
  sortSetRows,
  type LineSortKey,
  type SetSortKey,
  type SortState,
} from "@/components/investment/sorting";
import { SetChip, SummaryStat, profitClass } from "@/components/investment/ui";
import { investmentViewParams, parseInvestmentView } from "@/components/investment/url-state";
import { useInvestmentHistory, usePeriodReference } from "@/components/investment/use-investment-history";
import { useExchangeRates, useSales, useSellAlerts } from "@/components/investment/use-investment-ledger";
import { displayRows, useLineSelection } from "@/components/investment/use-line-selection";
import { formatSignedMoney, formatSignedPercent } from "@/components/TrendBadge";
import { ScreenError, ScreenSkeleton, SkeletonBlock, SkeletonRows } from "@/components/site/ScreenSkeleton";
import {
  applyInvestmentPeriod,
  buildInvestmentLines,
  buildSaleLines,
  filterInvestmentLines,
  filterSaleLines,
  groupInvestmentPositions,
  investmentBySet,
  investmentRateKeys,
  printingTitle,
  siblingPrintings,
  summarizeInvestment,
  summarizeSales,
  topMovers,
  valueConcentration,
  type InvestmentPerformance,
  type InvestmentPosition,
} from "@/lib/logic";
import {
  CARDS_GROUP_FILTER,
  isSealedSetCode,
  partitionCatalogSets,
  SEALED_GROUP_FILTER,
} from "@/lib/reference-data";

export function InvestmentScreen() {
  const fmt = useNumberFormat();
  // Textes des tableaux triés dans l'ordre alphabétique de la langue de la page.
  const locale = intlLocale(useLocale());
  const { ready, error, retry, user, catalog, items, saveLine, patchLine, deleteLine, pendingIds } = useCollection();
  const t = useTranslations();
  // Ventes, alertes de revente et taux de change : chargés une fois la collection du compte connue.
  const ledgerEnabled = ready && user != null;
  const sales = useSales(ledgerEnabled);
  const sellAlerts = useSellAlerts(ledgerEnabled);
  const rateKeys = useMemo(() => investmentRateKeys(items, sales.sales ?? []), [items, sales.sales]);
  const rates = useExchangeRates(rateKeys);
  // Fenêtres ouvertes depuis le détail ou la liste des ventes.
  const [sellTarget, setSellTarget] = useState<SellTarget | null>(null);
  const [alertPosition, setAlertPosition] = useState<InvestmentPosition | null>(null);
  // Vue lue dans l'URL : lien du tableau de bord, rechargement, lien partagé. Elle y est réécrite à chaque changement.
  const searchParams = useSearchParams();
  const [initialView] = useState(() => parseInvestmentView(searchParams));
  const [setFilter, setSetFilter] = useState(initialView.set);
  const [language, setLanguage] = useState(initialView.language);
  const searchKey = searchParams.toString();
  // Cartes dépliées dans le détail (printingId) : un achat par sous-ligne.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Fiche carte ouverte en popup depuis le détail.
  const [modalPrintingId, setModalPrintingId] = useState<string | null>(null);
  // Carte passée par l'URL (bloc prix d'une fiche) : ses lignes sont sélectionnées une fois la collection chargée.
  const [printingParam, setPrintingParam] = useState(() => searchParams.get("printing"));
  const [performance, setPerformance] = useState<InvestmentPerformance>(initialView.performance);
  const [query, setQuery] = useState(initialView.query);
  const [chartRange, setChartRange] = useState<ChartRange>(initialView.range);
  const period = usePeriodReference({ ready, catalog, items, range: chartRange });
  const [setSort, setSetSort] = useState<SortState<SetSortKey> | null>(initialView.setSort);
  const [lineSort, setLineSort] = useState<SortState<LineSortKey> | null>(initialView.lineSort);
  const effectiveSetSort = useMemo(
    () => setSort ?? ({ key: "marketValue", dir: "desc" } as SortState<SetSortKey>),
    [setSort],
  );
  const effectiveLineSort = useMemo(
    () => lineSort ?? ({ key: "market", dir: "desc" } as SortState<LineSortKey>),
    [lineSort],
  );

  const viewKey = investmentViewParams({
    set: setFilter,
    language,
    performance,
    query,
    range: chartRange,
    lineSort,
    setSort,
  }).toString();
  // URL écrites par la page que le routeur n'a pas encore renvoyées : les relire n'est pas une navigation.
  const pendingUrlKeys = useRef<string[]>([]);
  const seenSearchKey = useRef(searchKey);

  // La vue suit dans l'URL (sans nouvelle entrée d'historique) : un rechargement la retrouve.
  useEffect(() => {
    if (viewKey === new URLSearchParams(window.location.search).toString()) return;
    pendingUrlKeys.current.push(viewKey);
    const base = window.location.pathname;
    // Preserve Next history state so App Router does not ACTION_RESTORE.
    window.history.replaceState(window.history.state, "", viewKey ? `${base}?${viewKey}` : base);
  }, [viewKey]);

  const cardsById = useMemo(() => new Map(catalog?.cards.map((card) => [card.id, card]) ?? []), [catalog]);

  const ownedIds = useMemo(
    () => new Set(items.filter((item) => item.quantity > 0).map((item) => item.printingId)),
    [items],
  );
  const modalPrinting = modalPrintingId ? catalog?.printings.find((printing) => printing.id === modalPrintingId) : undefined;
  const modalCard = modalPrinting ? cardsById.get(modalPrinting.cardId) : undefined;

  // Achats en devise convertis en euros au taux BCE du jour d'achat.
  const baseLines = useMemo(() => {
    if (!catalog) return [];
    return buildInvestmentLines(items, catalog.printings, cardsById, rates);
  }, [cardsById, catalog, items, rates]);

  // Var. marché suit la durée choisie (le P&L, lui, part toujours du prix d'achat). Tant que les prix de
  // référence de cette durée manquent (chargement, échec) : pas de variation, plutôt que celle d'une autre durée.
  const allLines = useMemo(
    () => applyInvestmentPeriod(baseLines, period.reference?.prices ?? {}),
    [baseLines, period.reference],
  );

  const filtered = useMemo(
    () =>
      filterInvestmentLines(allLines, {
        set: setFilter,
        language,
        performance,
        q: query,
      }),
    [allLines, language, performance, query, setFilter],
  );

  // La liste par extension ignore le filtre d'extension : elle reste complète et sert de sélecteur,
  // l'extension choisie y est simplement surlignée (pas de liste qui se réduit à une ligne).
  const filteredAnySet = useMemo(
    () => filterInvestmentLines(allLines, { set: "all", language, performance, q: query }),
    [allLines, language, performance, query],
  );

  const selection = useLineSelection(filtered);
  const { selectedLines, select: selectItems, clear: clearSelection } = selection;
  if (printingParam && ready) {
    setPrintingParam(null);
    selectItems(items.filter((item) => item.printingId === printingParam && item.quantity > 0).map((item) => item.id));
  }

  // Lien suivi vers cette page alors qu'elle est ouverte (fiche carte, menu) : la vue repart de l'URL.
  useEffect(() => {
    if (searchKey === seenSearchKey.current) return;
    seenSearchKey.current = searchKey;
    const pending = pendingUrlKeys.current;
    const own = pending.indexOf(searchKey);
    if (own >= 0) {
      pending.splice(0, own + 1);
      return;
    }
    pending.length = 0;
    const params = new URLSearchParams(searchKey);
    const view = parseInvestmentView(params);
    setSetFilter(view.set);
    setLanguage(view.language);
    setPerformance(view.performance);
    setQuery(view.query);
    setChartRange(view.range);
    setLineSort(view.lineSort);
    setSetSort(view.setSort);
    setPrintingParam(params.get("printing"));
    clearSelection();
    // Lien suivi depuis une fiche ouverte ici : elle se ferme sur la nouvelle sélection.
    setModalPrintingId(null);
  }, [clearSelection, searchKey]);

  // La courbe porte sur les mêmes exemplaires que les chiffres : la sélection, sinon ceux du détail quand la
  // recherche ou la performance le restreint (null : extension et langue seules, courbe en cache côté serveur).
  // Clé stable : la courbe n'est rechargée que si la liste change vraiment.
  const chartItemsKey = useMemo(() => {
    const lines = selectedLines.length > 0 ? selectedLines : performance !== "all" || query.trim() ? filtered : null;
    return lines == null ? null : [...new Set(lines.map((line) => line.itemId))].sort().join(",");
  }, [filtered, performance, query, selectedLines]);
  const history = useInvestmentHistory({ ready, catalog, items, set: setFilter, language, itemsKey: chartItemsKey });
  // Premier jour de la durée : celui des prix de référence (même jour pour la courbe, les chiffres et les tableaux),
  // en attendant compté depuis le dernier point de la courbe.
  const periodStart = useMemo(
    () => (period.reference ? period.reference.day : chartRangeStart(history.points, chartRange)),
    [chartRange, history.points, period.reference],
  );

  // Achats datés affichés sur la courbe, avec le nom de la carte.
  const rangedChartPoints = useMemo(() => {
    const ranged = filterChartRange(history.points, chartRange);
    if (!catalog || history.purchases.length === 0) return ranged;
    const printingsById = new Map(catalog.printings.map((printing) => [printing.id, printing]));
    const purchases: ChartPurchase[] = history.purchases.map((purchase) => {
      const printing = printingsById.get(purchase.printingId);
      const card = printing ? cardsById.get(printing.cardId) : undefined;
      return {
        day: purchase.day,
        title: printing && card ? printingTitle(card, printing) : purchase.printingId,
        quantity: purchase.quantity,
        unitPrice: purchase.unitPrice,
        currency: purchase.currency,
      };
    });
    return attachPurchases(ranged, purchases, periodStart);
  }, [cardsById, catalog, chartRange, history.points, history.purchases, periodStart]);

  const summary = useMemo(
    () => summarizeInvestment(selectedLines.length > 0 ? selectedLines : filtered),
    [filtered, selectedLines],
  );
  const profitPct = lineProfitPct({ profit: summary.profitEur, profitBasis: summary.profitBasis });

  // Hausses, baisses et concentration : mêmes cartes que les chiffres du haut (sélection, sinon filtres).
  const summaryPositions = useMemo(
    () => groupInvestmentPositions(selectedLines.length > 0 ? selectedLines : filtered),
    [filtered, selectedLines],
  );
  const movers = useMemo(() => topMovers(summaryPositions), [summaryPositions]);
  const concentration = useMemo(() => valueConcentration(summaryPositions), [summaryPositions]);
  const moversHint = t("investment.movers.hint", {
    all: chartRange === "all" ? "yes" : "no",
    range: chartRangeLabel(chartRange, t),
  });

  // Ventes : mêmes filtres d'extension, de langue et de recherche que le détail.
  const saleLines = useMemo(
    () => (catalog ? buildSaleLines(sales.sales ?? [], catalog.printings, cardsById, rates) : []),
    [cardsById, catalog, rates, sales.sales],
  );
  const filteredSales = useMemo(
    () => filterSaleLines(saleLines, { set: setFilter, language, q: query }),
    [language, query, saleLines, setFilter],
  );
  const salesSummary = useMemo(() => summarizeSales(filteredSales), [filteredSales]);
  const realizedPct = lineProfitPct({ profit: salesSummary.realized, profitBasis: salesSummary.realizedBasis });
  const hasSales = saleLines.length > 0;

  const alertsByPrinting = useMemo(
    () => new Map((sellAlerts.alerts ?? []).map((alert) => [alert.printingId, alert])),
    [sellAlerts.alerts],
  );
  // Alertes de revente atteintes depuis la dernière visite : signalées le temps de la visite, puis marquées vues.
  const [freshAlertIds, setFreshAlertIds] = useState<ReadonlySet<string> | null>(null);
  if (sellAlerts.alerts && freshAlertIds === null) {
    setFreshAlertIds(new Set(sellAlerts.alerts.filter((alert) => alert.alertAt && !alert.alertSeen).map((alert) => alert.id)));
  }
  const { acknowledge: acknowledgeAlerts } = sellAlerts;
  useEffect(() => {
    if (freshAlertIds && freshAlertIds.size > 0) void acknowledgeAlerts().catch(() => undefined);
  }, [acknowledgeAlerts, freshAlertIds]);
  const freshAlerts = useMemo(() => {
    if (!catalog || !freshAlertIds || freshAlertIds.size === 0) return [];
    const printingsById = new Map(catalog.printings.map((printing) => [printing.id, printing]));
    return (sellAlerts.alerts ?? []).flatMap((alert) => {
      const printing = printingsById.get(alert.printingId);
      if (!freshAlertIds.has(alert.id) || !alert.alertAt || !printing) return [];
      return [{ alert, title: printingTitle(cardsById.get(printing.cardId), printing) }];
    });
  }, [cardsById, catalog, freshAlertIds, sellAlerts.alerts]);
  const bySet = useMemo(
    () => (catalog ? investmentBySet(filteredAnySet, catalog.sets) : []),
    [catalog, filteredAnySet],
  );
  const sortedBySet = useMemo(() => sortSetRows(bySet, effectiveSetSort, locale), [bySet, effectiveSetSort, locale]);
  const sortedCardSets = useMemo(
    () => sortedBySet.filter((row) => !isSealedSetCode(row.setCode)),
    [sortedBySet],
  );
  const sortedSealedSets = useMemo(
    () => sortedBySet.filter((row) => isSealedSetCode(row.setCode)),
    [sortedBySet],
  );
  // Une ligne par carte ; liste réduite à la sélection : seuls les achats sélectionnés restent.
  const visiblePositions = useMemo(
    () =>
      sortPositionRows(groupInvestmentPositions(selection.collapsed ? selectedLines : filtered), effectiveLineSort, locale),
    [effectiveLineSort, filtered, locale, selectedLines, selection.collapsed],
  );
  const rows = useMemo(() => displayRows(visiblePositions, expanded), [expanded, visiblePositions]);
  const setOptions = useMemo(() => {
    if (!catalog) return { cardSets: [], sealedSets: [] };
    const owned = new Set(allLines.map((line) => line.setCode));
    const ownedSets = catalog.sets.filter((set) => owned.has(set.code));
    return partitionCatalogSets(ownedSets);
  }, [allLines, catalog]);

  const selectedSetLabel =
    setFilter === "all"
      ? null
      : setFilter === CARDS_GROUP_FILTER
        ? t("investment.groupCards")
        : setFilter === SEALED_GROUP_FILTER
          ? t("investment.groupSealed")
          : (catalog?.sets.find((set) => set.code === setFilter)?.name ?? setFilter);

  // Re-cliquer l'extension sélectionnée la désélectionne (évite de remonter aux filtres sur mobile).
  const toggleSet = (code: string) => {
    setSetFilter((current) => (current === code ? "all" : code));
    clearSelection();
  };

  function toggleExpanded(printingId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(printingId)) next.add(printingId);
      return next;
    });
  }

  const renderSetChip = () =>
    selectedSetLabel ? (
      <SetChip label={selectedSetLabel} ariaLabel={t("investment.clearSet", { set: selectedSetLabel })} onClear={() => setSetFilter("all")} />
    ) : null;

  const renderItemChip = () => {
    if (selectedLines.length === 0) return null;
    // Compté en cartes : plusieurs achats d'une même carte = une ligne.
    const cardCount = new Set(selectedLines.map((line) => line.printingId)).size;
    const label =
      cardCount === 1
        ? selectedLines[0].title
        : t("investment.selectedLines", { count: fmt.int(cardCount), n: cardCount });
    return <SetChip label={label} ariaLabel={t("investment.clearSet", { set: label })} onClear={clearSelection} />;
  };

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
        <ScreenError message={error} onRetry={retry} />
      </div>
    );
  }
  if (!ready || !catalog) return <InvestmentSkeleton />;
  if (catalog.printings.length === 0) {
    return <p className="p-6 text-sm text-muted">{t("investment.emptyCatalog")}</p>;
  }
  // Collection vide : la page n'a rien à montrer, sauf des ventes passées.
  if (baseLines.length === 0 && !hasSales) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-4 sm:py-6">
        <h1 className="text-2xl text-yellow sm:text-4xl">{t("investment.eyebrow")}</h1>
        <section className="flex max-w-xl flex-col items-start gap-3 border border-line bg-panel p-6">
          <h2 className="text-lg">{t("investment.emptyCollectionTitle")}</h2>
          <p className="text-sm leading-6 text-muted">{t("investment.emptyCollectionBody")}</p>
          <Link
            href="/cards"
            className="inline-flex h-10 items-center bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110"
          >
            {t("investment.addCards")}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-4 sm:py-6">
      <h1 className="text-2xl text-yellow sm:text-4xl">{t("investment.eyebrow")}</h1>

      <section className={`grid grid-cols-2 gap-2 sm:gap-3 ${hasSales ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <SummaryStat
          label={t("investment.marketValue")}
          value={summary.pricedCopies > 0 ? fmt.money(summary.marketTotal) : "—"}
          delta={summary.marketDelta}
          deltaAmount={summary.marketDeltaAmount}
          detail={
            chartRange === "all"
              ? t("investment.periodDetailAll")
              : t("investment.periodDetail", { range: chartRangeLabel(chartRange, t) })
          }
        />
        <SummaryStat
          label={t("investment.invested")}
          value={summary.investedEur > 0 ? fmt.money(summary.investedEur) : "—"}
        />
        <SummaryStat
          label={t("investment.pnl")}
          value={summary.profitEur == null ? "—" : fmt.money(summary.profitEur)}
          tone={summary.profitEur == null ? undefined : summary.profitEur >= 0 ? "gain" : "loss"}
          aside={
            profitPct == null ? null : (
              <span className={`font-mono ${profitClass(summary.profitEur)}`}>{formatSignedPercent(fmt, profitPct)}</span>
            )
          }
          // Le P&L ne compte que les exemplaires qui ont un prix d'achat (EUR) et un prix marché.
          detail={
            summary.profitEur == null
              ? null
              : t("investment.pnlBasis", {
                  count: fmt.int(summary.trackedProfitCopies),
                  total: fmt.int(summary.copies),
                  n: summary.copies,
                })
          }
        />
        <SummaryStat
          label={t("investment.trackedCopies")}
          value={`${fmt.int(summary.pricedCopies)} / ${fmt.int(summary.copies)}`}
        />
        {hasSales ? (
          <SummaryStat
            className="col-span-2 xl:col-span-1"
            label={t("investment.realized")}
            value={salesSummary.realized == null ? "—" : formatSignedMoney(fmt, salesSummary.realized)}
            tone={salesSummary.realized == null ? undefined : salesSummary.realized >= 0 ? "gain" : "loss"}
            aside={
              realizedPct == null ? null : (
                <span className={`font-mono ${profitClass(salesSummary.realized)}`}>{formatSignedPercent(fmt, realizedPct)}</span>
              )
            }
            detail={
              salesSummary.realized == null
                ? null
                : t("investment.realizedDetail", {
                    count: fmt.int(salesSummary.sales - salesSummary.unknownCost),
                    n: salesSummary.sales - salesSummary.unknownCost,
                  })
            }
          />
        ) : null}
      </section>

      {freshAlerts.length > 0 ? (
        <section role="status" className="border border-yellow/60 bg-yellow/10 px-4 py-3 text-sm">
          <h2 className="font-semibold text-yellow">{t("investment.alert.reachedTitle", { n: freshAlerts.length })}</h2>
          <ul className="mt-1 flex flex-col gap-0.5">
            {freshAlerts.map(({ alert, title }) => (
              <li key={alert.id}>
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:text-cyan hover:underline"
                  onClick={() => setModalPrintingId(alert.printingId)}
                >
                  {t("investment.alert.reachedItem", {
                    name: title,
                    price: fmt.money(Number(alert.alertPrice ?? alert.targetPrice)),
                    target: fmt.money(Number(alert.targetPrice)),
                  })}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!catalog.hasPrices ? <p className="text-sm text-muted">{t("investment.noPrices")}</p> : null}
      {summary.unconvertedLines > 0 ? (
        <p className="text-sm text-muted">{t("investment.unconverted", { n: summary.unconvertedLines })}</p>
      ) : null}

      <InvestmentChart
        chartRange={chartRange}
        setChartRange={setChartRange}
        chartStatus={history.status}
        chartLoaded={history.loaded}
        rangedChartPoints={rangedChartPoints}
        onRetry={history.retry}
        referenceError={period.error}
        onRetryReference={period.retry}
      />

      {/* Juste au-dessus des tableaux : les filtres agissent sur ce qui est affiché dessous. */}
      <InvestmentFilters
        setFilter={setFilter}
        setSetFilter={setSetFilter}
        language={language}
        setLanguage={setLanguage}
        performance={performance}
        setPerformance={setPerformance}
        query={query}
        setQuery={setQuery}
        setOptions={setOptions}
      />

      {summaryPositions.length > 0 ? (
        <MoversPanel
          gainers={movers.gainers}
          losers={movers.losers}
          concentration={concentration}
          hint={moversHint}
          openCard={setModalPrintingId}
        />
      ) : null}

      <SetTable
        bySet={bySet}
        sortedCardSets={sortedCardSets}
        sortedSealedSets={sortedSealedSets}
        setFilter={setFilter}
        toggleSet={toggleSet}
        effectiveSetSort={effectiveSetSort}
        setSetSort={setSetSort}
        setChip={renderSetChip()}
      />

      <LineTable
        filtered={filtered}
        positions={visiblePositions}
        effectiveLineSort={effectiveLineSort}
        setLineSort={setLineSort}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        selectedItemIds={selection.selectedItemIds}
        rangeAnchor={selection.rangeAnchor}
        onRowClick={(event, rowKey, itemIds) => selection.onRowClick(event, rowKey, itemIds, rows)}
        onRowToggle={selection.onRowToggle}
        openCard={setModalPrintingId}
        setChip={
          <>
            {renderSetChip()}
            {renderItemChip()}
          </>
        }
        alerts={alertsByPrinting}
        onSell={(position, itemId) => setSellTarget({ kind: "sell", position, itemId })}
        onAlert={setAlertPosition}
      />

      {hasSales ? (
        <SalesTable
          lines={filteredSales}
          onEdit={(sale) => setSellTarget({ kind: "edit", sale })}
          onUndo={(sale) => sales.undo(sale.saleId)}
          openCard={setModalPrintingId}
        />
      ) : sales.error ? (
        <ScreenError message={t("investment.sales.loadError")} onRetry={sales.retry} />
      ) : null}

      {sellTarget ? (
        <SellDialog
          target={sellTarget}
          rates={rates}
          pendingIds={pendingIds}
          onSell={sales.sell}
          onUpdate={sales.update}
          onClose={() => setSellTarget(null)}
        />
      ) : null}
      {alertPosition ? (
        <SellAlertDialog
          position={alertPosition}
          alert={alertsByPrinting.get(alertPosition.printingId) ?? null}
          onSave={sellAlerts.save}
          onRemove={sellAlerts.remove}
          onClose={() => setAlertPosition(null)}
        />
      ) : null}

      {modalPrinting && modalCard ? (
        <CardModal
          printing={modalPrinting}
          card={modalCard}
          siblings={siblingPrintings(catalog.printings, modalPrinting)}
          items={items.filter((item) => item.printingId === modalPrinting.id)}
          conditions={catalog.conditions}
          ownedIds={ownedIds}
          onOpen={setModalPrintingId}
          onClose={() => setModalPrintingId(null)}
          onSave={(input) => saveLine({ ...input, printingId: modalPrinting.id, mode: "add" })}
          onPatch={patchLine}
          onDelete={deleteLine}
          pendingIds={pendingIds}
        />
      ) : null}
    </div>
  );
}

/** Squelette de l'investissement : titre, quatre chiffres, courbe, filtres et tableau. */
export function InvestmentSkeleton() {
  const t = useTranslations();
  return (
    <ScreenSkeleton
      label={t("investment.loading")}
      className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-4 sm:py-6"
    >
      <SkeletonBlock className="h-8 w-48 sm:h-10" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="h-20" />
        ))}
      </div>
      <SkeletonBlock className="h-[280px]" />
      <SkeletonBlock className="h-11 w-full max-w-2xl" />
      <SkeletonRows rows={6} />
    </ScreenSkeleton>
  );
}
