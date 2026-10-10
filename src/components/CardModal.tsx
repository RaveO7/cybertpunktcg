"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { chipColor, colorDotClass } from "@/components/CardTile";
import { PriceChart, type ChartPoint } from "@/components/PriceChart";
import { RulesText } from "@/components/RulesText";
import { TrendBadge, formatSignedMoney } from "@/components/TrendBadge";
import { useI18n } from "@/components/LocaleProvider";
import { usePreferences } from "@/components/PreferencesProvider";
import { conditionOptionLabel } from "@/lib/condition-label";
import type { CardDTO, CollectionItemDTO, ConditionDTO, Filters, PrintingDTO } from "@/lib/types";
import { baseCollectorNumber, formatInt, formatMoney, formatPercent, priceMovement, printingTitle, resolveRulesText } from "@/lib/logic";
import { CURRENCIES } from "@/lib/parse";
import { ICONIC_GRADIENT_SOFT, isIconicRarity, rarityColor } from "@/lib/rarity-color";
import { CardImage } from "@/components/CardImage";
import { WishlistPanel } from "@/components/WishlistPanel";

const fieldClass =
  "h-10 w-full border border-line bg-background px-2.5 text-sm outline-none transition focus:border-cyan focus-visible:ring-1 focus-visible:ring-cyan/70";

const iconBtnClass =
  "w-9 text-muted transition hover:bg-panel-2 hover:text-cyan focus-visible:bg-panel-2 focus-visible:text-cyan focus-visible:outline-none";

const headerBtnClass =
  "grid h-11 w-11 place-items-center border border-line text-foreground transition hover:border-yellow/50 hover:text-yellow disabled:cursor-default disabled:opacity-30 disabled:hover:border-line disabled:hover:text-foreground focus-visible:border-yellow/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow/70";

const fieldLabelClass = "block font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

const chipClass = "inline-flex h-6 items-center gap-1 border border-line/80 px-1.5 text-[11px]";

const chipButtonClass =
  "transition hover:border-cyan/60 hover:bg-cyan/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70";

/** Pastille de détail : un bouton qui filtre le catalogue quand `onClick` est fourni, sinon un simple libellé. */
function DetailChip({
  className,
  style,
  label,
  onClick,
  children,
}: {
  className: string;
  style?: CSSProperties;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (!onClick) return <span className={className} style={style}>{children}</span>;
  return (
    <button
      type="button"
      className={`${className} ${chipButtonClass}`}
      style={style}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/** Pastille de rareté teintée selon la rareté (même palette que le tableau de bord). */
function rarityChipStyle(rarity: string): CSSProperties | undefined {
  if (isIconicRarity(rarity)) {
    return {
      background: ICONIC_GRADIENT_SOFT,
      borderColor: "color-mix(in srgb, var(--rarity-chrome) 55%, transparent)",
      color: "var(--foreground)",
    };
  }
  const color = rarityColor(rarity);
  if (!color) return undefined;
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function conditionTone(code: string) {
  switch (code) {
    case "NM":
      return "bg-gain/15 text-gain";
    case "LP":
      return "bg-cyan/15 text-cyan";
    case "MP":
      return "bg-yellow/15 text-yellow";
    default:
      return "bg-danger/15 text-danger";
  }
}

function conditionDot(code: string) {
  switch (code) {
    case "NM":
      return "bg-gain";
    case "LP":
      return "bg-cyan";
    case "MP":
      return "bg-yellow";
    default:
      return "bg-danger";
  }
}

function toAmount(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function formatSignedPercent(value: number) {
  const formatted = formatPercent(Math.abs(value), 1);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function CardModal({
  printing,
  card,
  siblings,
  items,
  conditions,
  ownedIds,
  onOpen,
  onClose,
  prevId,
  nextId,
  onFilterArtist,
  onFilterRarity,
  onFilterSet,
  onFilter,
  readOnly = false,
  onSave,
  onPatch,
  onDelete,
}: {
  printing: PrintingDTO;
  card: CardDTO;
  siblings: PrintingDTO[];
  items: CollectionItemDTO[];
  conditions: ConditionDTO[];
  ownedIds: Set<string>;
  onOpen: (id: string) => void;
  onClose: () => void;
  prevId?: string | null;
  nextId?: string | null;
  onFilterArtist?: (artist: string) => void;
  onFilterRarity?: (rarity: string) => void;
  onFilterSet?: (set: string) => void;
  onFilter?: (patch: Partial<Filters>) => void;
  readOnly?: boolean;
  onSave?: (input: {
    conditionCode: string;
    quantity: number;
    notes?: string | null;
    purchasePrice?: string | null;
    purchaseCurrency?: string | null;
  }) => Promise<void>;
  onPatch?: (id: string, input: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { prefs } = usePreferences();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const formErrorId = useId();
  const [conditionCode, setConditionCode] = useState(prefs.condition);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>(prefs.currency);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [priceHistory, setPriceHistory] = useState<ChartPoint[]>([]);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [costHintOpen, setCostHintOpen] = useState(false);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const title = printingTitle(card, printing);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const rules = resolveRulesText(card, printing, siblings, locale);
  const accent = chipColor(card.color);

  const market = toAmount(printing.marketPrice);
  const previous = toAmount(printing.previousMarketPrice);
  const movement = priceMovement(market, previous);
  const marketDelta = market != null && previous != null ? market - previous : null;
  const marketDeltaPct = marketDelta != null && previous ? (marketDelta / previous) * 100 : null;

  // Gain/loss on the copies with a purchase price (EUR only), valued at the market price.
  let purchaseCost = 0;
  let pricedCopies = 0;
  for (const item of items) {
    const unit = toAmount(item.purchasePrice);
    if (unit == null || (item.purchaseCurrency ?? "EUR") !== "EUR") continue;
    purchaseCost += unit * item.quantity;
    pricedCopies += item.quantity;
  }
  const profit = market != null && pricedCopies > 0 ? market * pricedCopies - purchaseCost : null;

  // Selected printing first, then the same artwork (same number across beta/retail/languages,
  // then same artist and rarity), then the other printings.
  const appearanceRank = (entry: PrintingDTO) => {
    if (entry.id === printing.id) return 0;
    if (baseCollectorNumber(entry.collectorNumber) === baseCollectorNumber(printing.collectorNumber)) return 1;
    if (entry.artist && entry.artist === printing.artist && entry.rarity === printing.rarity) return 2;
    return 3;
  };
  const allPrintings = [...siblings, printing].sort(
    (a, b) =>
      appearanceRank(a) - appearanceRank(b) ||
      a.setName.localeCompare(b.setName, "fr") ||
      a.collectorNumber.localeCompare(b.collectorNumber, "fr", { numeric: true }),
  );

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Autre carte ou préférences modifiées : le formulaire d'ajout repart des préférences.
  const formDefaultsKey = `${prefs.condition}|${prefs.currency}|${printing.id}`;
  const [syncedFormDefaults, setSyncedFormDefaults] = useState(formDefaultsKey);
  if (formDefaultsKey !== syncedFormDefaults) {
    setSyncedFormDefaults(formDefaultsKey);
    setConditionCode(prefs.condition);
    setCurrency(prefs.currency);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && prevId) {
        event.preventDefault();
        onOpen(prevId);
        return;
      }
      if (event.key === "ArrowRight" && nextId) {
        event.preventDefault();
        onOpen(nextId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onOpen, prevId, nextId]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const response = await fetch(
          `/api/investment/history?printingId=${encodeURIComponent(printing.id)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("history");
        const body = (await response.json()) as { points?: { day: string; amount: number }[] };
        if (cancelled) return;
        setPriceHistory((body.points ?? []).map((point) => ({ day: point.day, value: point.amount })));
      } catch {
        if (!cancelled) setPriceHistory([]);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [printing.id]);

  async function add() {
    if (!onSave) return;
    setPending(true);
    setMessage(null);
    try {
      await onSave({
        conditionCode,
        quantity,
        notes: notes.trim() ? notes.trim() : undefined,
        purchasePrice: price.trim() ? price.trim() : undefined,
        purchaseCurrency: price.trim() ? currency : undefined,
      });
      setNotes("");
      setPrice("");
      setQuantity(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.modal.addFailed);
    } finally {
      setPending(false);
    }
  }

  const stats = [
    card.cost != null ? { key: "costs", label: t.filters.cost, value: String(card.cost) } : null,
    card.power != null ? { key: "powers", label: t.filters.power, value: String(card.power) } : null,
    card.ram != null ? { key: "rams", label: t.filters.ram, value: String(card.ram) } : null,
  ].filter((entry): entry is { key: "costs" | "powers" | "rams"; label: string; value: string } => entry != null);
  const filterOn = (patch: Partial<Filters>) => (onFilter ? () => onFilter(patch) : undefined);

  const canEdit = !readOnly && onPatch && onDelete;

  // Téléphone : balayer la fiche vers la gauche/droite passe à la carte suivante/précédente.
  function onTouchStart(event: React.TouchEvent) {
    const target = event.target;
    if (event.touches.length !== 1 || isTypingTarget(target)) {
      swipeRef.current = null;
      return;
    }
    if (target instanceof Element && target.closest("[data-no-swipe]")) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && nextId) onOpen(nextId);
    else if (dx > 0 && prevId) onOpen(prevId);
  }

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-[var(--app-bottom-nav)] z-50 overflow-y-auto overscroll-contain bg-black/80 p-0 sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="px-safe pt-safe flex min-h-full flex-col bg-panel sm:mx-auto sm:block sm:min-h-0 sm:max-w-6xl sm:border sm:border-line sm:shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 sm:static sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="truncate text-xl font-bold leading-tight tracking-[-0.02em] text-yellow sm:text-[2rem]"
            >
              {card.subname && !printing.localizedName ? (
                <>
                  {card.name} <span className="font-normal text-foreground">{card.subname}</span>
                </>
              ) : (
                title
              )}
            </h2>
          </div>
          {(prevId || nextId) && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className={headerBtnClass}
                onClick={() => prevId && onOpen(prevId)}
                disabled={!prevId}
                aria-label={t.modal.previousCard}
                title={t.modal.previousCard}
              >
                <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="square" />
                </svg>
              </button>
              <button
                type="button"
                className={headerBtnClass}
                onClick={() => nextId && onOpen(nextId)}
                disabled={!nextId}
                aria-label={t.modal.nextCard}
                title={t.modal.nextCard}
              >
                <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="square" />
                </svg>
              </button>
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            className={`${headerBtnClass} shrink-0`}
            onClick={onClose}
            aria-label={t.modal.close}
            title={t.modal.close}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </header>

        {/* Mobile: aside + main column flatten (`contents`) so `order-*` can interleave them like the mockup. */}
        <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="contents md:sticky md:top-4 md:flex md:flex-col md:gap-5">
            <figure
              className="order-1 mx-auto w-full max-w-[210px] overflow-hidden rounded-2xl border bg-black p-2 md:order-none md:max-w-none"
              style={
                {
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  boxShadow: `0 18px 60px color-mix(in srgb, ${accent} 20%, transparent)`,
                } as CSSProperties
              }
            >
              {printing.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={printing.imagePath} alt="" className="w-full rounded-xl object-contain" />
              ) : (
                <div
                  className="flex aspect-[63/88] items-center justify-center text-sm text-muted"
                  role="img"
                  aria-label={t.modal.noImage}
                >
                  {t.modal.noImage}
                </div>
              )}
            </figure>

            {(printing.rarity || card.color || card.cardType || stats.length > 0 || card.tags.length > 0 || card.isEddiable != null) && (
              <div className="order-3 flex flex-wrap items-center gap-1 md:order-none" aria-label={t.modal.details}>
                {card.color ? (
                  <DetailChip className={chipClass} label={t.modal.filterBy(card.color)} onClick={filterOn({ colors: [card.color] })}>
                    <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
                    {card.color}
                  </DetailChip>
                ) : null}
                {card.cardType ? (
                  <DetailChip className={chipClass} label={t.modal.filterBy(card.cardType)} onClick={filterOn({ types: [card.cardType] })}>
                    {card.cardType}
                  </DetailChip>
                ) : null}
                {printing.rarity ? (
                  <DetailChip
                    className={`${chipClass} font-mono text-[10px] uppercase tracking-[0.04em] hover:brightness-125`}
                    style={rarityChipStyle(printing.rarity)}
                    label={t.modal.viewRarity(printing.rarity)}
                    onClick={onFilterRarity ? () => onFilterRarity(printing.rarity!) : undefined}
                  >
                    {printing.rarity}
                  </DetailChip>
                ) : null}
                {stats.map((stat) => (
                  <DetailChip
                    key={stat.key}
                    className={chipClass}
                    label={t.modal.filterBy(`${stat.label} ${stat.value}`)}
                    onClick={filterOn({ [stat.key]: [stat.value] })}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">{stat.label}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-cyan">{stat.value}</span>
                  </DetailChip>
                ))}
                {card.tags.map((tag) => (
                  <DetailChip
                    key={tag}
                    className={`${chipClass} font-mono text-[10px] uppercase tracking-[0.04em] text-muted`}
                    label={t.modal.filterBy(tag)}
                    onClick={filterOn({ tags: [tag] })}
                  >
                    {tag}
                  </DetailChip>
                ))}
                {card.isEddiable != null ? (
                  <DetailChip
                    label={t.modal.filterBy(card.isEddiable ? t.modal.eddiesSellable : t.modal.eddiesNotSellable)}
                    onClick={filterOn({ eddiable: card.isEddiable ? "true" : "false" })}
                    className={
                      card.isEddiable
                        ? "inline-flex h-6 items-center gap-1 border border-gain/45 bg-gain/10 px-1.5 text-[11px] text-gain"
                        : `${chipClass} text-muted`
                    }
                  >
                    {card.isEddiable ? (
                      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8.5 6.5 12 13 4.5" />
                      </svg>
                    ) : null}
                    {card.isEddiable ? t.modal.eddiesSellable : t.modal.eddiesNotSellable}
                  </DetailChip>
                ) : null}
              </div>
            )}

            {siblings.length > 0 ? (
              <section aria-labelledby={`${titleId}-printings`} className="order-9 flex min-w-0 flex-col gap-3 md:order-none">
                <h3 id={`${titleId}-printings`} className="hud-label text-muted">
                  {t.modal.printings} · {allPrintings.length}
                </h3>
                <ul data-no-swipe="" className="scrollbar-hud -mx-4 flex gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
                  {allPrintings.map((entry) => {
                    const label = `#${entry.collectorNumber} · ${entry.setName}`;
                    const current = entry.id === printing.id;
                    const owned = ownedIds.has(entry.id);
                    const entryPrice = toAmount(entry.marketPrice);
                    return (
                      <li key={entry.id} className="w-[66px] shrink-0 md:w-[74px]">
                        <button
                          type="button"
                          className={`group relative block w-full border text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 ${
                            current
                              ? "border-yellow bg-yellow/5 ring-1 ring-yellow"
                              : "border-line/80 hover:border-cyan/60"
                          }`}
                          onClick={() => !current && onOpen(entry.id)}
                          aria-current={current ? "true" : undefined}
                          aria-label={current ? t.modal.currentPrinting(label) : t.modal.openPrinting(label)}
                          title={label}
                        >
                          {entry.imagePath ? (
                            <CardImage
                              src={entry.imagePath}
                              alt=""
                              loading="lazy"
                              className="aspect-[63/88] w-full bg-black object-cover"
                            />
                          ) : (
                            <span
                              className="flex aspect-[63/88] w-full items-center justify-center bg-background text-[9px] text-muted"
                              aria-hidden="true"
                            >
                              —
                            </span>
                          )}
                          {owned ? (
                            <span
                              className="absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center bg-yellow text-black"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 16 16" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M3 8.5 6.5 12 13 4.5" />
                              </svg>
                            </span>
                          ) : null}
                          <span
                            className={`flex items-center justify-between gap-1 px-1.5 py-1 font-mono text-[10px] tabular-nums ${
                              current ? "text-yellow" : "text-muted group-hover:text-cyan"
                            }`}
                          >
                            <span className="truncate">{entry.collectorNumber}</span>
                            <span className={`shrink-0 ${!current && entryPrice != null ? "text-foreground/80" : ""}`}>
                              {entryPrice != null ? formatMoney(entryPrice) : "—"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </aside>

          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
            {/* Sans prix ni historique Cardmarket, le bloc n'a rien à montrer. */}
            {market != null || priceHistory.length > 0 ? (
            <section data-no-swipe="" className="hud-panel order-7 overflow-hidden md:order-none" aria-labelledby={`${titleId}-market`}>
              <div className="flex min-w-0 flex-col gap-2.5 p-4">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h3 id={`${titleId}-market`} className="hud-label text-cyan">
                      {t.modal.marketPrice}
                    </h3>
                    <p className="mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums" aria-live="polite">
                      {market != null ? formatMoney(market) : "—"}
                    </p>
                  </div>
                  {movement === "up" || movement === "down" ? (
                    <p className="text-[13px]" title={t.modal.trend}>
                      <TrendBadge delta={movement} amount={marketDelta} />
                      {marketDeltaPct != null ? (
                        <span className={`font-mono ${movement === "up" ? "text-gain" : "text-danger"}`}>
                          {" · "}
                          {formatSignedPercent(marketDeltaPct)}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <PriceChart
                  points={priceHistory}
                  label={t.modal.chartLabel}
                  height={80}
                  compact
                  emptyHint={t.modal.chartEmpty}
                />
              </div>

              {/* Seul le gain/perte est ajouté : la valeur et le coût d'achat figurent déjà ailleurs.
                  Masqué tant qu'aucun prix d'achat (EUR) ne permet de le calculer. */}
              {profit != null ? (
              <p className="flex items-baseline justify-between gap-3 border-t border-cyan/15 px-4 py-2.5 sm:px-5">
                <span className={`${fieldLabelClass} flex items-center gap-1.5`}>
                  {t.modal.profitLoss}
                  {total > 0 && pricedCopies < total ? (
                    <span className="group relative normal-case tracking-normal">
                      <button
                        type="button"
                        className="relative grid h-4 w-4 place-items-center rounded-full border border-line text-[10px] leading-none text-muted transition before:absolute before:-inset-3 before:content-[''] hover:border-cyan hover:text-cyan focus-visible:border-cyan focus-visible:text-cyan focus-visible:outline-none"
                        aria-label={t.modal.partialCost(formatInt(pricedCopies), formatInt(total))}
                        aria-expanded={costHintOpen}
                        // iOS ne donne pas le focus à un bouton touché : l'info-bulle s'ouvre au tap.
                        onClick={() => setCostHintOpen((value) => !value)}
                        onBlur={() => setCostHintOpen(false)}
                      >
                        ?
                      </button>
                      <span
                        role="tooltip"
                        className={`pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-56 ${costHintOpen ? "block" : "hidden"} border border-cyan/50 bg-black/95 px-2.5 py-1.5 font-sans text-xs leading-relaxed text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.55)] group-focus-within:block group-hover:block`}
                      >
                        {t.modal.partialCost(formatInt(pricedCopies), formatInt(total))}
                      </span>
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    Math.abs(profit) < 0.005 ? "text-muted" : profit > 0 ? "text-gain" : "text-danger"
                  }`}
                >
                  {formatSignedMoney(profit)}
                </span>
              </p>
              ) : null}
            </section>
            ) : null}

            {rules.text ? (
              <div className="order-4 md:order-none">
                <RulesText label={t.modal.rulesText} text={rules.text} />
              </div>
            ) : null}

            {card.flavorText ? (
              <blockquote className="order-5 border-l-2 md:order-none border-yellow/40 pl-3 text-sm italic leading-relaxed text-muted">
                <span className="sr-only">{t.modal.flavorText}. </span>
                {card.flavorText}
              </blockquote>
            ) : null}

            <section className="hud-panel order-6 overflow-hidden md:order-none" aria-labelledby={`${titleId}-collection`}>
              <div className="flex items-center justify-between gap-3 border-b border-cyan/15 px-4 py-3 sm:px-5">
                <h3 id={`${titleId}-collection`} className="hud-label text-cyan">
                  {readOnly ? t.filters.collection : t.modal.myCollection}
                </h3>
                {items.length === 0 ? <p className="text-xs text-muted">{t.modal.notInCollection}</p> : null}
              </div>

              {items.length > 0 ? (
                <div className="px-4 pb-1 pt-2 sm:px-5">
                  {canEdit ? (
                    <div
                      className="hidden gap-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted md:grid md:grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_minmax(0,1fr)_2.75rem]"
                      aria-hidden="true"
                    >
                      <span>{t.modal.condition}</span>
                      <span>{t.modal.quantity}</span>
                      <span>{t.modal.unitPurchasePrice}</span>
                      <span>{t.modal.notes}</span>
                      <span />
                    </div>
                  ) : null}
                  <ul className="flex flex-col">
                    {items.map((item) => (
                      <li
                        key={`${item.id}:${item.conditionCode}:${item.notes ?? ""}:${item.purchasePrice ?? ""}:${item.purchaseCurrency ?? ""}`}
                        className="border-t border-line/50 py-2.5 first:border-t-0 md:first:border-t"
                      >
                        {canEdit ? (
                          <LineEditor item={item} conditions={conditions} onPatch={onPatch} onDelete={onDelete} />
                        ) : (
                          <LineReadonly item={item} conditions={conditions} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!readOnly && onSave ? (
                <form
                  className="hidden px-4 pb-3 pt-2 sm:px-5 md:block"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void add();
                  }}
                  aria-labelledby={`${titleId}-add`}
                  aria-describedby={message ? formErrorId : undefined}
                >
                  <h3 id={`${titleId}-add`} className="py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
                    {t.modal.addCopy}
                  </h3>
                  {items.length === 0 ? (
                    <div
                      className="grid grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_minmax(0,1fr)_2.75rem] gap-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
                      aria-hidden="true"
                    >
                      <span>{t.modal.condition}</span>
                      <span>{t.modal.quantity}</span>
                      <span>{t.modal.unitPurchasePrice}</span>
                      <span>{t.modal.notes}</span>
                      <span />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_minmax(0,1fr)_2.75rem] items-center gap-3 border-t border-line/50 py-2.5">
                    <span className="relative flex h-10 items-center">
                      <span className={`pointer-events-none absolute left-2 top-1/2 z-10 h-2 w-2 -translate-y-1/2 ${conditionDot(conditionCode)}`} aria-hidden="true" />
                      <select
                        className="h-full w-full min-w-0 border border-line bg-background pl-6 pr-1 font-mono text-sm outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/70"
                        value={conditionCode}
                        onChange={(event) => setConditionCode(event.target.value)}
                        aria-label={t.modal.condition}
                      >
                        {conditions.map((condition) => (
                          <option key={condition.code} value={condition.code} className="font-mono" title={condition.name}>
                            {conditionOptionLabel(condition, conditions)}
                          </option>
                        ))}
                      </select>
                    </span>
                    <div className="inline-flex h-10 w-full items-stretch border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
                      <button
                        type="button"
                        className={iconBtnClass}
                        aria-label={t.modal.decreaseQty}
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      >
                        −
                      </button>
                      <input
                        className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm outline-none"
                        inputMode="numeric"
                        aria-label={t.modal.quantity}
                        value={quantity}
                        onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                      />
                      <button
                        type="button"
                        className={iconBtnClass}
                        aria-label={t.modal.increaseQty}
                        onClick={() => setQuantity((current) => current + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="flex h-10 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
                      <input
                        className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={t.modal.unitPurchasePrice}
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                      />
                      <select
                        className="shrink-0 border-l border-line bg-panel px-1.5 font-mono text-xs text-foreground/80 outline-none"
                        value={currency}
                        onChange={(event) => setCurrency(event.target.value)}
                        aria-label={t.modal.currency}
                      >
                        {CURRENCIES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      className={fieldClass}
                      placeholder={t.modal.notesPlaceholder}
                      aria-label={t.modal.notes}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex h-10 items-center justify-center bg-yellow text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/80 disabled:opacity-60"
                      aria-label={pending ? t.modal.adding : t.modal.add}
                      title={t.modal.add}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v10M3 8h10" />
                      </svg>
                    </button>
                  </div>
                  {message ? (
                    <p id={formErrorId} role="alert" className="text-sm text-danger">
                      {message}
                    </p>
                  ) : null}
                </form>
              ) : null}
            </section>

            {!readOnly && onSave ? <WishlistPanel printingId={printing.id} marketPrice={market} /> : null}

            <footer className="order-8 flex flex-col gap-1.5 text-[13px] text-muted md:order-none md:flex-row md:flex-wrap md:items-center md:gap-x-7 md:gap-y-2">
              {printing.artist ? (
                <span>
                  {t.modal.artist} ·{" "}
                  {onFilterArtist ? (
                    <button
                      type="button"
                      className="text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
                      onClick={() => onFilterArtist(printing.artist!)}
                      aria-label={t.modal.viewArtist(printing.artist)}
                    >
                      {printing.artist}
                    </button>
                  ) : (
                    <span className="text-foreground">{printing.artist}</span>
                  )}
                </span>
              ) : null}
              {printing.officialFinish ? (
                <span>
                  {t.modal.finish} · <span className="text-foreground">{printing.officialFinish}</span>
                </span>
              ) : null}
              {printing.setName ? (
                <span>
                  {t.modal.set} ·{" "}
                  {onFilterSet ? (
                    <button
                      type="button"
                      className="text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
                      onClick={() => onFilterSet(printing.setCode)}
                      aria-label={t.modal.viewSet(printing.setName)}
                    >
                      {printing.setName}
                    </button>
                  ) : (
                    <span className="text-foreground">{printing.setName}</span>
                  )}
                </span>
              ) : null}
              <span>
                {t.modal.number} · <span className="font-mono text-foreground">{printing.collectorNumber}</span>
              </span>
            </footer>
          </div>
        </div>

        {!readOnly && onSave ? (
          <form
            className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-line bg-panel-2 px-4 pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom)-var(--app-bottom-nav)))] pt-3 md:hidden"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            aria-label={t.modal.addCopy}
            aria-describedby={message ? `${formErrorId}-m` : undefined}
          >
            <div
              role="group"
              aria-label={t.modal.condition}
              className="grid border border-line"
              style={{ gridTemplateColumns: `repeat(${Math.max(conditions.length, 1)}, minmax(0, 1fr))` }}
            >
              {conditions.map((condition, index) => {
                const active = condition.code === conditionCode;
                return (
                  <button
                    key={condition.code}
                    type="button"
                    aria-pressed={active}
                    title={condition.name}
                    onClick={() => setConditionCode(condition.code)}
                    className={`h-11 font-mono text-[13px] transition focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70 ${
                      index > 0 ? "border-l border-line" : ""
                    } ${active ? "bg-yellow font-semibold text-black" : "text-muted"}`}
                  >
                    {condition.code}
                  </button>
                );
              })}
            </div>
            {showMoreFields ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex h-11 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[15px] outline-none"
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={t.modal.unitPurchasePrice}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                  <select
                    className="shrink-0 border-l border-line bg-panel px-2 font-mono text-xs text-foreground/80 outline-none"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    aria-label={t.modal.currency}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={`${fieldClass} h-11`}
                  placeholder={t.modal.notesPlaceholder}
                  aria-label={t.modal.notes}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            ) : null}
            <div className="flex gap-2.5">
              <div className="flex h-12 items-stretch border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
                <button
                  type="button"
                  className={`${iconBtnClass} w-11 text-lg`}
                  aria-label={t.modal.decreaseQty}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  −
                </button>
                <input
                  className="w-8 min-w-0 bg-transparent text-center font-mono text-base outline-none"
                  inputMode="numeric"
                  aria-label={t.modal.quantity}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                />
                <button
                  type="button"
                  className={`${iconBtnClass} w-11 text-lg`}
                  aria-label={t.modal.increaseQty}
                  onClick={() => setQuantity((current) => current + 1)}
                >
                  +
                </button>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap bg-yellow px-3 text-sm font-semibold sm:gap-2 sm:px-4 sm:text-[15px] text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/80 disabled:opacity-60"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                {pending ? t.modal.adding : t.modal.addToCollection}
              </button>
            </div>
            <button
              type="button"
              className="h-9 text-[13px] text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
              onClick={() => setShowMoreFields((value) => !value)}
              aria-expanded={showMoreFields}
            >
              {showMoreFields ? "− " : "+ "}
              {t.modal.moreFields}
            </button>
            {message ? (
              <p id={`${formErrorId}-m`} role="alert" className="text-sm text-danger">
                {message}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}

function LineReadonly({
  item,
  conditions,
}: {
  item: CollectionItemDTO;
  conditions: ConditionDTO[];
}) {
  const { t } = useI18n();
  const conditionName = conditions.find((entry) => entry.code === item.conditionCode)?.name;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className={`px-1.5 py-0.5 font-mono text-xs ${conditionTone(item.conditionCode)}`}>{item.conditionCode}</span>
      {conditionName ? <span>{conditionName}</span> : null}
      <span className="ml-auto font-mono text-muted">
        <span className="sr-only">{t.modal.quantity} </span>×{item.quantity}
      </span>
    </div>
  );
}

function LineEditor({
  item,
  conditions,
  onPatch,
  onDelete,
}: {
  item: CollectionItemDTO;
  conditions: ConditionDTO[];
  onPatch: (id: string, input: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  // Quantité saisie mais pas encore envoyée : affichée tout de suite, envoyée en un seul PATCH
  // une fois les clics terminés. null = on affiche la valeur de la collection.
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPatchRef = useRef(onPatch);
  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);
  const quantity = pendingQty ?? item.quantity;

  function flushQuantity() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const value = pendingRef.current;
    if (value == null) return;
    pendingRef.current = null;
    setPendingQty(null);
    // En cas d'échec, le provider restaure la ligne : l'affichage revient à la valeur serveur.
    onPatchRef.current(item.id, { quantity: value }).catch(() => {});
  }

  function setQuantity(next: number) {
    pendingRef.current = next;
    setPendingQty(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (next <= 0) flushQuantity();
    else timerRef.current = setTimeout(flushQuantity, 350);
  }

  // Fermer la fenêtre pendant le délai ne doit pas perdre la dernière quantité.
  useEffect(() => () => flushQuantity(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [notes, setNotes] = useState(item.notes ?? "");
  const [price, setPrice] = useState(item.purchasePrice ?? "");
  const [editing, setEditing] = useState(false);

  const conditionName = conditions.find((entry) => entry.code === item.conditionCode)?.name;
  const labelClass = `${fieldLabelClass} mb-1 md:sr-only`;
  const unit = toAmount(item.purchasePrice);
  const unitLabel = unit == null ? null : formatMoney(unit, item.purchaseCurrency || "EUR");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 md:hidden">
        <span className={`px-1.5 py-0.5 font-mono text-xs ${conditionTone(item.conditionCode)}`}>{item.conditionCode}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm">
            ×{quantity}
            {unitLabel ? ` · ${unitLabel}` : ""}
          </span>
          {item.notes ? <span className="truncate text-xs text-muted">{item.notes}</span> : null}
        </div>
        <button
          type="button"
          className={`grid h-11 w-11 shrink-0 place-items-center border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 ${
            editing ? "border-cyan/60 text-cyan" : "border-line text-muted"
          }`}
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
          aria-label={editing ? t.modal.doneEditing : t.modal.editLine(item.conditionCode)}
        >
          {editing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5V10.5Z" />
            </svg>
          )}
        </button>
      </div>
    <div
      className={`${editing ? "grid" : "hidden"} grid-cols-2 gap-x-3 gap-y-2.5 md:grid md:grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_minmax(0,1fr)_2.75rem] md:items-center`}
    >
      <label className="block">
        <span className={labelClass}>{t.modal.condition}</span>
        <span className="relative flex h-10 items-center">
          <span className={`pointer-events-none absolute left-2 top-1/2 z-10 h-2 w-2 -translate-y-1/2 ${conditionDot(item.conditionCode)}`} aria-hidden="true" />
          <select
            className="h-full w-full min-w-0 border border-line bg-background pl-6 pr-1 font-mono text-sm outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/70"
            value={item.conditionCode}
            onChange={(event) => void onPatch(item.id, { conditionCode: event.target.value })}
            title={conditionName ? `${item.conditionCode} — ${conditionName}` : t.modal.condition}
          >
            {conditions.map((condition) => (
              <option key={condition.code} value={condition.code} className="font-mono" title={condition.name}>
                {conditionOptionLabel(condition, conditions)}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div>
        <span className={labelClass} aria-hidden="true">
          {t.modal.quantity}
        </span>
        <div className="inline-flex h-10 w-full items-stretch border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
          <button
            type="button"
            className={iconBtnClass}
            aria-label={t.modal.decreaseQty}
            onClick={() => setQuantity(quantity - 1)}
          >
            −
          </button>
          <input
            aria-label={t.modal.quantity}
            inputMode="numeric"
            className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm outline-none"
            value={draft ?? String(quantity)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft == null) return;
              setDraft(null);
              const next = Number(draft);
              if (draft.trim() !== "" && Number.isInteger(next) && next !== quantity) setQuantity(next);
            }}
          />
          <button
            type="button"
            className={iconBtnClass}
            aria-label={t.modal.increaseQty}
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="col-span-2 md:col-span-1">
        <span className={labelClass} aria-hidden="true">
          {t.modal.unitPurchasePrice}
        </span>
        <div className="flex h-10 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
            placeholder="—"
            aria-label={t.modal.unitPurchasePrice}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => {
              if ((item.purchasePrice ?? "") !== price.trim()) {
                void onPatch(item.id, {
                  purchasePrice: price.trim() ? price.trim() : null,
                  purchaseCurrency: item.purchaseCurrency ?? "EUR",
                });
              }
            }}
          />
          <select
            className="shrink-0 border-l border-line bg-panel px-1.5 font-mono text-xs text-foreground/80 outline-none"
            value={item.purchaseCurrency ?? "EUR"}
            onChange={(event) => void onPatch(item.id, { purchaseCurrency: event.target.value })}
            aria-label={t.modal.currency}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="col-span-2 block md:col-span-1">
        <span className={labelClass}>{t.modal.notes}</span>
        <input
          className={fieldClass}
          placeholder={t.modal.notesPlaceholder}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if ((item.notes ?? "") !== notes.trim()) void onPatch(item.id, { notes });
          }}
        />
      </label>

      <button
        type="button"
        className="col-span-2 inline-flex h-10 items-center justify-center gap-2 border border-danger/35 text-xs text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/70 md:col-span-1"
        onClick={() => void onDelete(item.id)}
        aria-label={t.modal.remove}
        title={t.modal.remove}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
        </svg>
        <span className="md:hidden">{t.modal.remove}</span>
      </button>
    </div>
    </div>
  );
}
