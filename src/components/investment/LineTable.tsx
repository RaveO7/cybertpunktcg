"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/i18n/config";
import { useNumberFormat } from "@/i18n/number-format";
import type { Translator } from "@/i18n/translator";
import { CardImage } from "@/components/CardImage";
import { useIsDesktop } from "@/components/use-is-desktop";
import { MobileColumnHints, MobileSort, SortableTh } from "@/components/investment/SortControls";
import {
  LINE_SORT_KEYS,
  LINE_TABLE_KEYS,
  lineMarketDelta,
  lineMarketDeltaPct,
  lineSortLabel,
  type LineSortKey,
  type SortState,
} from "@/components/investment/sorting";
import { MarketChange, ProfitValue, moneyOrDash, profitClass } from "@/components/investment/ui";
import type { InvestmentLine, InvestmentPosition } from "@/lib/logic";

/** Clic sur une ligne : sa clé (carte ou achat) et les achats qu'elle couvre. */
type RowClick = (event: MouseEvent, rowKey: string, itemIds: string[]) => void;

/** Sélection d'une carte : tous ses achats, aucun, ou une partie. */
type Selection = boolean | "mixed";

/** Cartes rendues d'un coup ; les suivantes arrivent quand la fin de la liste approche. */
const ROWS_PER_PAGE = 100;

/**
 * Détail par carte (une ligne par carte, dépliable en un achat par sous-ligne) :
 * liste sur téléphone, tableau triable sur ordinateur — une seule des deux est rendue.
 */
export function LineTable({
  filtered,
  positions,
  effectiveLineSort,
  setLineSort,
  expanded,
  onToggleExpanded,
  selectedItemIds,
  rangeAnchor,
  onRowClick,
  onRowToggle,
  openCard,
  setChip,
}: {
  filtered: InvestmentLine[];
  positions: InvestmentPosition[];
  /** Tri appliqué, celui par défaut compris : la colonne triée est toujours signalée. */
  effectiveLineSort: SortState<LineSortKey>;
  setLineSort: (sort: SortState<LineSortKey>) => void;
  /** Cartes dépliées (printingId). */
  expanded: ReadonlySet<string>;
  onToggleExpanded: (printingId: string) => void;
  selectedItemIds: ReadonlySet<string>;
  /** Ligne choisie par Alt+clic, en attente de la fin de plage. */
  rangeAnchor: string | null;
  /** Tableau (ordinateur) : clic, Ctrl+clic, Alt+clic. */
  onRowClick: RowClick;
  /** Liste (téléphone) : toucher une ligne la coche ou la décoche, sans réduire la liste. */
  onRowToggle: (itemIds: string[]) => void;
  openCard: (printingId: string) => void;
  setChip: ReactNode;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const isDesktop = useIsDesktop();
  const [limit, setLimit] = useState(ROWS_PER_PAGE);
  const showMore = useCallback(() => setLimit((current) => current + ROWS_PER_PAGE), []);
  const shown = positions.length > limit ? positions.slice(0, limit) : positions;
  const columns = LINE_SORT_KEYS.map((key) => ({ key, label: lineSortLabel(key, t) }));
  const rowProps = (position: InvestmentPosition, touch: boolean) => {
    const itemIds = position.lines.map((line) => line.itemId);
    return {
      position,
      t,
      selected: positionSelection(position, selectedItemIds),
      anchor: rangeAnchor === position.printingId,
      open: isOpen(position, expanded),
      onToggle: () => onToggleExpanded(position.printingId),
      onSelect: (event: MouseEvent) => (touch ? onRowToggle(itemIds) : onRowClick(event, position.printingId, itemIds)),
      onOpenCard: () => openCard(position.printingId),
    };
  };
  const purchaseProps = (position: InvestmentPosition, line: InvestmentLine, touch: boolean) => ({
    line,
    title: position.title,
    t,
    active: selectedItemIds.has(line.itemId),
    anchor: rangeAnchor === line.itemId,
    onSelect: (event: MouseEvent) => (touch ? onRowToggle([line.itemId]) : onRowClick(event, line.itemId, [line.itemId])),
  });
  return (

    <section>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-lg">{t("investment.detail")}</h2>
        {setChip}
      </div>
      <p className="mb-1 text-xs text-muted sm:text-sm">
        {t("investment.detailHint", { count: fmt.int(positions.length), noun: t("common.lines", { n: positions.length }) })}
      </p>
      <p className="mb-3 text-xs text-muted">{t(isDesktop ? "investment.selectHint" : "investment.selectHintTouch")}</p>
      {filtered.length === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-sm text-muted">{t("investment.noResults")}</p>
      ) : !isDesktop ? (
        <>
          <MobileSort options={columns} sort={effectiveLineSort} onSort={setLineSort} t={t} />
          <MobileColumnHints columns={columns} t={t} />
          <ul className="border border-line bg-panel">
            {shown.map((position) => (
              <Fragment key={position.printingId}>
                <PositionItem {...rowProps(position, true)} />
                {isOpen(position, expanded)
                  ? position.lines.map((line) => <PurchaseItem key={line.itemId} {...purchaseProps(position, line, true)} />)
                  : null}
              </Fragment>
            ))}
          </ul>
          {shown.length < positions.length ? (
            <MoreRows remaining={positions.length - shown.length} onMore={showMore} t={t} />
          ) : null}
        </>
      ) : (
        <>
          <div className="scrollbar-hud relative overflow-x-auto overscroll-x-contain border border-line">
            <table className="w-full min-w-[46rem] text-left text-sm [&_td]:whitespace-nowrap [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-panel [&_td:first-child]:whitespace-normal [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-panel-2">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  {LINE_TABLE_KEYS.map((key) => (
                    <SortableTh
                      key={key}
                      label={lineSortLabel(key, t)}
                      columnKey={key}
                      sort={effectiveLineSort}
                      onSort={setLineSort}
                      t={t}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((position) => (
                  <Fragment key={position.printingId}>
                    <PositionRow {...rowProps(position, false)} />
                    {isOpen(position, expanded)
                      ? position.lines.map((line) => <PurchaseRow key={line.itemId} {...purchaseProps(position, line, false)} />)
                      : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length < positions.length ? (
            <MoreRows remaining={positions.length - shown.length} onMore={showMore} t={t} />
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Fin de la liste partielle : les cartes suivantes arrivent à l'approche du bas de page,
 * ou au clic (clavier, lecteur d'écran).
 */
function MoreRows({ remaining, onMore, t }: { remaining: number; onMore: () => void; t: Translator }) {
  const fmt = useNumberFormat();
  const ref = useRef<HTMLButtonElement>(null);
  // Observé de nouveau après chaque ajout : tant que le bas reste proche, la suite continue d'arriver.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onMore();
      },
      { rootMargin: "0px 0px 800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onMore, remaining]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onMore}
      className="mt-2 w-full border border-line bg-panel px-3 py-2 text-sm text-muted hover:border-cyan hover:text-cyan"
    >
      {t("investment.showMore", { count: fmt.int(remaining), n: remaining })}
    </button>
  );
}

type PositionProps = {
  position: InvestmentPosition;
  t: Translator;
  selected: Selection;
  anchor: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: (event: MouseEvent) => void;
  onOpenCard: () => void;
};

type PurchaseProps = {
  line: InvestmentLine;
  /** Nom de la carte, pour le libellé d'accessibilité. */
  title: string;
  t: Translator;
  active: boolean;
  anchor: boolean;
  onSelect: (event: MouseEvent) => void;
};

function PositionRow({ position, t, selected, anchor, open, onToggle, onSelect, onOpenCard }: PositionProps) {
  const fmt = useNumberFormat();
  // Clic sur la ligne : sélection ; clic sur le nom : fiche carte.
  return (
    <tr className={`cursor-pointer select-none border-t border-line ${rowClass(selected, anchor)}`} onClick={onSelect}>
      <td className="p-0">
        <div className="flex w-44 items-center gap-3 px-3 py-2 sm:w-auto sm:min-w-56">
          <SelectThumb position={position} t={t} selected={selected} className="h-12 w-9" />
          <span>
            <span className="block font-mono text-xs text-muted">#{position.collectorNumber}</span>
            <CardNameButton position={position} t={t} active={selected === true} onOpenCard={onOpenCard} className="block" />
            <span className="block text-xs text-muted">
              {conditionsAndRarity(position)}
              {position.lines.length > 1 ? (
                <>
                  {" · "}
                  <PurchasesToggle count={position.lines.length} t={t} open={open} onToggle={onToggle} />
                </>
              ) : null}
            </span>
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-muted">{position.setName}</td>
      <td className="px-3 py-2 font-mono">×{position.quantity}</td>
      <td className="px-3 py-2 font-mono">
        <PurchaseValue position={position} t={t} />
      </td>
      <td className="px-3 py-2 font-mono">
        {moneyOrDash(fmt, position.marketTotal)}
        <MarketUnit position={position} t={t} />
      </td>
      <td className="px-3 py-2">
        <MarketVar row={position} />
      </td>
      <td className={`px-3 py-2 font-mono ${profitClass(position.profit)}`}>
        <ProfitValue profit={position.profit} basis={position.profitBasis} />
      </td>
    </tr>
  );
}

/** Un achat d'une carte dépliée, aligné sous le nom de la carte. */
function PurchaseRow({ line, title, t, active, anchor, onSelect }: PurchaseProps) {
  const fmt = useNumberFormat();
  return (
    <tr className={`cursor-pointer select-none border-t border-line/40 ${rowClass(active, anchor)}`} onClick={onSelect}>
      <td className="p-0">
        <div className="py-1.5 pr-3 pl-15">
          <PurchaseLabel line={line} title={title} t={t} active={active} />
          <span className="block text-xs text-muted">{line.conditionCode}</span>
        </div>
      </td>
      <td />
      <td className="px-3 py-1.5 font-mono">×{line.quantity}</td>
      <td className="px-3 py-1.5 font-mono">{moneyOrDash(fmt, line.purchaseTotal, line.purchaseCurrency)}</td>
      <td className="px-3 py-1.5 font-mono">{moneyOrDash(fmt, line.marketTotal)}</td>
      <td className="px-3 py-1.5">
        <MarketVar row={line} />
      </td>
      <td className={`px-3 py-1.5 font-mono ${profitClass(line.profit)}`}>
        <ProfitValue profit={line.profit} basis={line.profitBasis} />
      </td>
    </tr>
  );
}

function PositionItem({ position, t, selected, anchor, open, onToggle, onSelect, onOpenCard }: PositionProps) {
  const fmt = useNumberFormat();
  return (
    <li
      className={`flex cursor-pointer select-none gap-3 border-t border-line px-3 py-3 first:border-t-0 ${rowClass(selected, anchor)}`}
      onClick={onSelect}
    >
      <SelectThumb position={position} t={t} selected={selected} className="h-16 w-12 shrink-0" check />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardNameButton position={position} t={t} active={selected === true} onOpenCard={onOpenCard} className="block max-w-full truncate" />
            <p className="truncate text-xs text-muted">
              #{position.collectorNumber} · {conditionsAndRarity(position)}
            </p>
            <p className="truncate text-xs text-muted">{position.setName}</p>
            {position.lines.length > 1 ? (
              <p className="text-xs">
                <PurchasesToggle count={position.lines.length} t={t} open={open} onToggle={onToggle} />
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono">
              {moneyOrDash(fmt, position.marketTotal)}
              <MarketUnit position={position} t={t} />
            </p>
            <p className="text-xs">
              <MarketVar row={position} />
            </p>
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-x-3 text-xs">
          <div className="min-w-0">
            <dt className="text-muted">{t("investment.qty")}</dt>
            <dd className="font-mono">×{position.quantity}</dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate text-muted">{t("investment.purchase")}</dt>
            <dd className="truncate font-mono">
              <PurchaseValue position={position} t={t} />
            </dd>
          </div>
          <div className="min-w-0 text-right">
            <dt className="truncate text-muted">{t("investment.purchasePnL")}</dt>
            <dd className={`truncate font-mono ${profitClass(position.profit)}`}>
              <ProfitValue profit={position.profit} basis={position.profitBasis} />
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

/** Un achat d'une carte dépliée (téléphone), aligné sous le nom de la carte. */
function PurchaseItem({ line, title, t, active, anchor, onSelect }: PurchaseProps) {
  const fmt = useNumberFormat();
  return (
    <li
      className={`flex cursor-pointer select-none gap-3 border-t border-line/40 px-3 py-2 text-xs ${rowClass(active, anchor)}`}
      onClick={onSelect}
    >
      {/* Colonne de la vignette : la case, le texte reste aligné sous le nom de la carte. */}
      <span className="flex w-12 shrink-0 justify-end pt-0.5">
        <CheckBox checked={active} />
      </span>
      <div className="min-w-0 flex-1">
        <PurchaseLabel line={line} title={title} t={t} active={active} />
        <p className="truncate text-muted">
          {line.conditionCode} · ×{line.quantity} ·{" "}
          <span className="font-mono">{moneyOrDash(fmt, line.purchaseTotal, line.purchaseCurrency)}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono">{moneyOrDash(fmt, line.marketTotal)}</p>
        <p className={`font-mono ${profitClass(line.profit)}`}>
          <ProfitValue profit={line.profit} basis={line.profitBasis} />
        </p>
      </div>
    </li>
  );
}

/** « 2 achats ▸ » : déplie la carte en un achat par sous-ligne, sans changer la sélection. */
function PurchasesToggle({ count, t, open, onToggle }: { count: number; t: Translator; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      className="text-cyan hover:underline"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {t("investment.purchaseCount", { n: count })}{" "}
      <span aria-hidden className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
        ▸
      </span>
    </button>
  );
}

/** Achat d'une carte : total, puis la date (un seul achat) ou le prix de revient unitaire (plusieurs). */
function PurchaseValue({ position, t }: { position: InvestmentPosition; t: Translator }) {
  const fmt = useNumberFormat();
  const locale = useLocale();
  const single = position.lines.length === 1 ? position.lines[0] : null;
  return (
    <>
      {moneyOrDash(fmt, position.purchaseTotal, position.purchaseCurrency)}
      {single?.purchasedAt ? (
        <span className="block font-sans text-xs text-muted">{formatPurchaseDay(single.purchasedAt, locale)}</span>
      ) : !single && position.purchaseUnit != null ? (
        <span className="block font-sans text-xs text-muted">
          {t("investment.averageCost", { amount: fmt.money(position.purchaseUnit, position.purchaseCurrency || "EUR") })}
        </span>
      ) : null}
    </>
  );
}

/** Prix unitaire sous la valeur de la carte, quand elle compte plusieurs exemplaires. */
function MarketUnit({ position, t }: { position: InvestmentPosition; t: Translator }) {
  const fmt = useNumberFormat();
  if (position.marketUnit == null || position.quantity < 2) return null;
  return (
    <span className="block font-sans text-xs text-muted">
      {t("investment.marketUnit", { amount: fmt.money(position.marketUnit) })}
    </span>
  );
}

/** Variation du marché : % en principal, montant total de la ligne en dessous (rien si stable). */
function MarketVar({ row }: { row: Pick<InvestmentLine, "marketUnit" | "previousMarketUnit" | "quantity" | "marketDelta"> }) {
  return <MarketChange delta={row.marketDelta} percent={lineMarketDeltaPct(row)} amount={lineMarketDelta(row)} />;
}

/** Case de la liste tactile : cochée, à moitié (une partie des achats de la carte) ou vide. */
function CheckBox({ checked }: { checked: Selection }) {
  return (
    <span
      aria-hidden
      className={`grid h-5 w-5 shrink-0 place-items-center border text-xs leading-none ${
        checked ? "border-cyan bg-cyan text-background" : "border-line bg-background/90"
      }`}
    >
      {checked === true ? "✓" : checked === "mixed" ? "–" : null}
    </span>
  );
}

/** Début de plage (Alt+clic) : cadre pointillé en attendant la seconde ligne. */
const ANCHOR_CLASS = "outline outline-1 -outline-offset-1 outline-dashed outline-cyan";

/** Fond d'une ligne (carte ou achat) selon sa sélection, et cadre du début de plage. */
function rowClass(selected: Selection, anchor: boolean) {
  const tone = selected === true ? "bg-cyan/10" : selected === "mixed" ? "bg-cyan/5 hover:bg-white/5" : "hover:bg-white/5";
  return anchor ? `${tone} ${ANCHOR_CLASS}` : tone;
}

/** « NM, EX · Rare » : états des achats, puis rareté. */
function conditionsAndRarity(position: InvestmentPosition) {
  const conditions = position.conditionCodes.join(", ");
  return position.rarity ? `${conditions} · ${position.rarity}` : conditions;
}

function positionSelection(position: InvestmentPosition, selectedItemIds: ReadonlySet<string>): Selection {
  const count = position.lines.filter((line) => selectedItemIds.has(line.itemId)).length;
  if (count === 0) return false;
  return count === position.lines.length ? true : "mixed";
}

function isOpen(position: InvestmentPosition, expanded: ReadonlySet<string>) {
  return position.lines.length > 1 && expanded.has(position.printingId);
}

/**
 * Vignette : bouton de sélection au clavier (le clic remonte jusqu'à la ligne, qui sélectionne).
 * Liste tactile (`check`) : une case dans le coin montre qu'un toucher coche la ligne.
 */
function SelectThumb({
  position,
  t,
  selected,
  className,
  check = false,
}: {
  position: InvestmentPosition;
  t: Translator;
  selected: Selection;
  className: string;
  check?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={t("investment.selectLine", { name: position.title })}
      className={`relative ${className} ${selected === true ? "outline outline-1 outline-cyan" : ""}`}
    >
      {position.imagePath ? (
        <CardImage src={position.imagePath} alt="" className="h-full w-full bg-black object-contain" loading="lazy" />
      ) : (
        <span className="grid h-full w-full place-items-center bg-black text-[10px] text-muted">N/A</span>
      )}
      {check ? (
        <span className="absolute -top-1.5 -left-1.5">
          <CheckBox checked={selected} />
        </span>
      ) : null}
    </button>
  );
}

/** Date de l'achat : bouton de sélection au clavier de la sous-ligne (le clic remonte jusqu'à elle). */
function PurchaseLabel({ line, title, t, active }: { line: InvestmentLine; title: string; t: Translator; active: boolean }) {
  const locale = useLocale();
  const label = line.purchasedAt ? formatPurchaseDay(line.purchasedAt, locale) : t("investment.noPurchaseDate");
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={t("investment.selectLine", { name: `${title}, ${label}` })}
      className={`block text-left text-sm ${active ? "text-cyan" : ""}`}
    >
      {label}
    </button>
  );
}

/** Nom de la carte : ouvre la fiche en popup sans sélectionner la ligne. */
function CardNameButton({
  position,
  t,
  active,
  onOpenCard,
  className,
}: {
  position: InvestmentPosition;
  t: Translator;
  active: boolean;
  onOpenCard: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      title={t("investment.openCard", { name: position.title })}
      className={`${className} text-left underline-offset-2 hover:text-cyan hover:underline ${active ? "text-cyan" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpenCard();
      }}
    >
      {position.title}
    </button>
  );
}

/** Date d'achat courte (« 12 mars 2026 »). */
function formatPurchaseDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}
