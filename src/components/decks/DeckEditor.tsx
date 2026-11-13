"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { useRouter } from "@/i18n/navigation";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { useCollection } from "@/components/CollectionProvider";
import { CardPreview } from "@/components/decks/CardPreview";
import { DEFAULT_FILTERS, DeckBrowser, type BrowserFilters } from "@/components/decks/DeckBrowser";
import { ExportPanel, ImportPanel } from "@/components/decks/TransferPanels";
import { ShareDeckPanel } from "@/components/decks/ShareDeckPanel";
import { ShortfallPanel } from "@/components/decks/ShortfallPanel";
import { useDeckCatalog, useDeckSaver, type SaveStatus } from "@/components/decks/hooks";
import {
  BackLink,
  DeleteDeckDialog,
  PencilIcon,
  Stepper,
  ValidityBadge,
  buttonClass,
  issueText,
  panelClass,
  primaryClass,
} from "@/components/decks/ui";
import {
  DECK_RULES,
  analyzeDeck,
  cardLabel,
  deckShortfall,
  isLegal,
  isLegend,
  maxCopies,
  ownedCopiesByCard,
  ramAllowed,
  type DeckAnalysis,
  type DeckEntry,
  type DeckLine,
  type ShortfallLine,
} from "@/lib/deck-rules";
import { COLOR_ORDER, TYPE_ORDER } from "@/lib/reference-data";
import type { CardDTO, CatalogDTO, DeckDTO, PrintingDTO } from "@/lib/types";

type Pane = "deck" | "add";

/**
 * Éditeur : à gauche (bureau) les cartes à ajouter, qui défilent avec la page ; à droite le deck,
 * collé en haut. Sur écran tactile et téléphone, aucune zone ne défile dans une autre.
 */
export function DeckEditor({
  deck,
  catalog,
  onSaved,
  onDelete,
}: {
  deck: DeckDTO;
  catalog: CatalogDTO;
  onSaved: (deck: DeckDTO) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const router = useRouter();
  const { items } = useCollection();
  const index = useDeckCatalog(catalog);
  const owned = useMemo(() => ownedCopiesByCard(items, catalog.printings), [items, catalog.printings]);
  const [name, setName] = useState(deck.name);
  const [entries, setEntries] = useState<DeckEntry[]>(deck.cards);
  const [pane, setPane] = useState<Pane>(deck.cards.length > 0 ? "deck" : "add");
  const [panel, setPanel] = useState<"none" | "export" | "import" | "share">("none");
  const [filters, setFilters] = useState<BrowserFilters>(DEFAULT_FILTERS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saver = useDeckSaver(deck.id, onSaved);
  const browserRef = useRef<HTMLElement>(null);

  const analysis = useMemo(() => analyzeDeck(entries, index.cardsById), [entries, index.cardsById]);
  const allLines = useMemo(() => [...analysis.legends, ...analysis.main], [analysis]);
  const shortfall = useMemo(() => deckShortfall(allLines, index.printingsByCard, owned), [allLines, index.printingsByCard, owned]);
  const lineByCard = useMemo(() => new Map(shortfall.lines.map((line) => [line.card.id, line])), [shortfall]);
  const quantities = useMemo(() => new Map(entries.map((entry) => [entry.cardId, entry.quantity])), [entries]);

  function updateCards(next: DeckEntry[]) {
    setEntries(next);
    saver.queue({ cards: next });
  }

  function setQuantity(cardId: string, quantity: number) {
    const rest = entries.filter((entry) => entry.cardId !== cardId);
    updateCards(quantity > 0 ? [...rest, { cardId, quantity }] : rest);
  }

  /** Pourquoi une carte de plus est refusée (copies max, 3 Legends aux noms différents), ou null. */
  const blockReason = (card: CardDTO) => {
    const quantity = quantities.get(card.id) ?? 0;
    if (quantity >= maxCopies(card)) return isLegend(card) ? t("decks.reasonLegendCopy") : t("decks.reasonCopies");
    if (!isLegend(card)) return null;
    if (analysis.legendCount >= DECK_RULES.legends) return t("decks.reasonLegendFull");
    return analysis.legends.some((line) => line.card.name === card.name) ? t("decks.reasonLegendName", { name: card.name }) : null;
  };
  const canAdd = (card: CardDTO) => blockReason(card) === null;

  // Carte affichée en aperçu et liste dans laquelle on navigue (résultats de recherche ou deck).
  const [previewing, setPreviewing] = useState<{ cardId: string; list: string[] } | null>(null);
  const openPreview = (cardId: string, list: string[]) => setPreviewing({ cardId, list });
  const closePreview = useCallback(() => setPreviewing(null), []);
  const navigatePreview = useCallback((cardId: string) => setPreviewing((current) => current && { ...current, cardId }), []);
  const previewCard = previewing ? index.cardsById.get(previewing.cardId) : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const paneScroll = useRef<Partial<Record<Pane, number>>>({});
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  /** Change d'onglet (téléphone) en retrouvant la position de défilement propre à chaque onglet. */
  function switchPane(next: Pane) {
    if (next === pane) return;
    const scroller = rootRef.current?.closest("main");
    setPane(next);
    if (!scroller) return;
    paneScroll.current[pane] = scroller.scrollTop;
    // Première visite : on garde la barre d'onglets en haut de l'écran.
    const target = paneScroll.current[next] ?? Math.min(scroller.scrollTop, tabsRef.current?.offsetTop ?? 0);
    requestAnimationFrame(() => scroller.scrollTo({ top: target }));
  }

  /** Glissement horizontal sur téléphone : vers la gauche « Ajouter des cartes », vers la droite « Deck ». */
  function onTouchStart(event: React.TouchEvent) {
    swipeStart.current = null;
    if (event.touches.length !== 1 || window.matchMedia("(min-width: 1024px)").matches) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [role=dialog], [data-no-swipe]")) return;
    const touch = event.touches[0];
    // Les bords de l'écran restent au geste « retour » du système.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    switchPane(dx < 0 ? "add" : "deck");
  }

  /** Emplacement de Legend vide : affiche les Legends dans la recherche. */
  function browseLegends() {
    setFilters({ ...DEFAULT_FILTERS, type: "Legend" });
    setPane("add");
    requestAnimationFrame(() => browserRef.current?.scrollIntoView({ block: "start" }));
  }

  function commitName() {
    const next = name.trim().slice(0, 60);
    if (!next) {
      setName(deck.name);
      return;
    }
    if (next !== name) setName(next);
    if (next !== deck.name) saver.queue({ name: next });
  }

  async function remove() {
    setDeleteError(null);
    try {
      await onDelete(deck.id);
      router.push("/decks");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("decks.failed"));
    }
  }

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4 px-3 pt-3 pb-8 sm:px-5 lg:pt-5"
      data-swipe-zone=""
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <BackLink />
          <SaveIndicator status={saver.status} error={saver.error} onRetry={() => void saver.retry()} />
          <span className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "import"}
              onClick={() => setPanel(panel === "import" ? "none" : "import")}
            >
              {t("decks.import")}
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "export"}
              onClick={() => setPanel(panel === "export" ? "none" : "export")}
            >
              {t("decks.export")}
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "share"}
              onClick={() => setPanel(panel === "share" ? "none" : "share")}
            >
              {t("decks.share")}
            </button>
            <button type="button" className={buttonClass} onClick={() => setConfirmDelete(true)}>
              {t("decks.delete")}
            </button>
            {confirmDelete ? (
              <DeleteDeckDialog
                name={name}
                onConfirm={() => {
                  setConfirmDelete(false);
                  void remove();
                }}
                onCancel={() => setConfirmDelete(false)}
              />
            ) : null}
          </span>
        </div>
        <label className="flex max-w-2xl flex-col gap-1.5">
          <span className="hud-label">{t("decks.name")}</span>
          <span className="flex items-center gap-2 border border-line bg-panel px-3 transition hover:border-muted focus-within:border-cyan">
            <input
              className="h-12 min-w-0 flex-1 bg-transparent text-xl text-yellow outline-none sm:text-2xl"
              value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <PencilIcon className="h-5 w-5 shrink-0 text-yellow/80" />
          </span>
        </label>
        {deleteError ? (
          <p role="alert" className="text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
      </header>

      {panel === "export" ? <ExportPanel lines={allLines} onClose={() => setPanel("none")} /> : null}
      {panel === "share" ? <ShareDeckPanel deckId={deck.id} onClose={() => setPanel("none")} /> : null}
      {panel === "import" ? (
        <ImportPanel
          cards={catalog.cards}
          onApply={(next) => {
            updateCards(next);
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {/* Téléphone / tablette : un onglet à la fois, barre d'onglets collée en haut. */}
      <div ref={tabsRef} className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:-mx-5 sm:px-5 lg:hidden">
        <div className="flex border border-line" role="tablist" aria-label={t("decks.title")}>
          {(["deck", "add"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              className={`flex h-11 flex-1 items-center justify-center gap-2 text-sm ${pane === key ? "bg-yellow text-black" : "text-muted"}`}
              onClick={() => switchPane(key)}
            >
              {key === "deck" ? (
                <>
                  {t("decks.deckTab")}
                  <span className="font-mono tabular-nums">
                    {fmt.int(analysis.legendCount + analysis.mainCount)}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${analysis.valid ? "bg-gain" : "bg-danger"}`} aria-hidden="true" />
                </>
              ) : (
                t("decks.addCards")
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section
          ref={browserRef}
          aria-labelledby="deck-picker"
          // Onglet masqué : invisible mais toujours mis en page (pas de display: none), sinon la grille
          // virtualisée mesure ses rangées à 0 px et perd sa hauteur (et la position de défilement).
          className={`${
            pane === "add" ? "deck-pane-from-right" : "pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
          } min-w-0 scroll-mt-16 lg:pointer-events-auto lg:visible lg:static lg:h-auto lg:overflow-visible lg:scroll-mt-0`}
        >
          <DeckBrowser
            pool={index.pool}
            extensions={index.extensions}
            filters={filters}
            onFilters={setFilters}
            analysis={analysis}
            quantities={quantities}
            owned={owned}
            preview={index.preview}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onPreview={openPreview}
          />
        </section>
        <aside
          aria-label={t("decks.deckTab")}
          className={`${pane === "deck" ? "flex" : "hidden"} deck-pane-from-left scrollbar-hud min-w-0 flex-col gap-4 lg:flex lg:pointer-fine:sticky lg:pointer-fine:top-0 lg:pointer-fine:max-h-[100cqh] lg:pointer-fine:overflow-y-auto lg:pointer-fine:py-5 lg:pointer-fine:pr-1`}
        >
          <DeckOverview
            analysis={analysis}
            preview={index.preview}
            onQuantity={setQuantity}
            onBrowseLegends={browseLegends}
            onPreview={openPreview}
          />
          <DeckCardList
            analysis={analysis}
            lineByCard={lineByCard}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onBrowse={() => switchPane("add")}
            onPreview={openPreview}
          />
          {analysis.mainCount > 0 ? <CostCurve curve={analysis.curve} /> : null}
          <ShortfallPanel shortfall={shortfall} printingsByCard={index.printingsByCard} />
        </aside>
      </div>

      {previewing && previewCard ? (
        <CardPreview
          card={previewCard}
          list={previewing.list}
          index={index}
          quantity={quantities.get(previewCard.id) ?? 0}
          owned={owned.get(previewCard.id) ?? 0}
          analysis={analysis}
          blockReason={blockReason(previewCard)}
          onNavigate={navigatePreview}
          onQuantity={setQuantity}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}

function SaveIndicator({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  const t = useTranslations();
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <span role="alert" className="flex items-center gap-2 text-xs text-danger">
        {error ?? t("decks.saveFailed")}
        <button type="button" className="underline hover:text-foreground" onClick={onRetry}>
          {t("decks.retry")}
        </button>
      </span>
    );
  }
  return (
    <span className="text-xs text-muted" aria-live="polite">
      {status === "saving" ? t("decks.saving") : t("decks.saved")}
    </span>
  );
}

/** En-tête du deck : légalité, 3 emplacements de Legends, RAM par couleur et problèmes. */
function DeckOverview({
  analysis,
  preview,
  onQuantity,
  onBrowseLegends,
  onPreview,
}: {
  analysis: DeckAnalysis;
  preview: Map<string, PrintingDTO>;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowseLegends: () => void;
  onPreview: (cardId: string, list: string[]) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const sizeOk = analysis.mainCount >= DECK_RULES.minCards && analysis.mainCount <= DECK_RULES.maxCards;
  const colors = COLOR_ORDER.filter((color) => analysis.ramLimits[color] != null);
  const slots = Array.from({ length: Math.max(DECK_RULES.legends, analysis.legends.length) }, (_, position) => analysis.legends[position]);
  return (
    <section className={`${panelClass} flex flex-col gap-4 p-4`} aria-labelledby="deck-validation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="deck-validation" className="hud-label">
            {t("decks.validation")}
          </h2>
          <p className="mt-1 font-mono text-3xl tabular-nums">
            <span className={sizeOk ? "text-gain" : "text-foreground"}>{fmt.int(analysis.mainCount)}</span>
            <span className="text-base text-muted">
              {" "}
              / {DECK_RULES.minCards}–{DECK_RULES.maxCards}
            </span>
          </p>
        </div>
        <ValidityBadge analysis={analysis} />
      </div>

      <div>
        <h3 className="hud-label mb-2">
          {t("decks.legends")} · {analysis.legendCount}/{DECK_RULES.legends}
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {slots.map((line, position) =>
            line ? (
              <li key={line.card.id} className="relative min-w-0">
                <button
                  type="button"
                  className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() => onPreview(line.card.id, analysis.legends.map((entry) => entry.card.id))}
                  aria-label={t("decks.viewCard", { name: cardLabel(line.card) })}
                >
                  {preview.get(line.card.id)?.imagePath ? (
                    <CardImage
                      src={preview.get(line.card.id)!.imagePath!}
                      alt=""
                      className="aspect-[63/88] w-full rounded-md bg-black object-contain"
                    />
                  ) : (
                    <span className="grid aspect-[63/88] w-full place-items-center rounded-md bg-black text-xs text-muted">N/A</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onQuantity(line.card.id, line.quantity - 1)}
                  className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-sm text-foreground hover:bg-danger"
                  aria-label={t("decks.removeOne", { name: cardLabel(line.card) })}
                >
                  ×
                </button>
                <p className="mt-1 truncate text-[11px]" title={cardLabel(line.card)}>
                  {line.card.name}
                </p>
              </li>
            ) : (
              <li key={`slot-${position}`} className="min-w-0">
                <button
                  type="button"
                  onClick={onBrowseLegends}
                  className="grid aspect-[63/88] w-full place-items-center rounded-md border border-dashed border-line text-xs text-muted transition hover:border-cyan hover:text-cyan"
                >
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-2xl leading-none" aria-hidden="true">
                      +
                    </span>
                    Legend
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {colors.length > 0 ? (
          colors.map((color) => (
            <span key={color} className="inline-flex h-6 items-center gap-1.5 border border-line px-1.5 text-[11px]">
              <span className={`h-2 w-2 rounded-full ${colorDotClass(color)}`} aria-hidden="true" />
              {t("decks.ramLimit", { color, n: analysis.ramLimits[color] })}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted">{t("decks.noRam")}</span>
        )}
      </div>

      {analysis.issues.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-line/60 pt-3 text-xs text-danger">
          {analysis.issues.map((issue, position) => (
            <li key={`${issue.code}-${position}`} className="flex gap-2">
              <span aria-hidden="true">✕</span>
              {issueText(t, issue)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Cartes du deck hors Legends, groupées par type, en lignes compactes. */
function DeckCardList({
  analysis,
  lineByCard,
  canAdd,
  onQuantity,
  onBrowse,
  onPreview,
}: {
  analysis: DeckAnalysis;
  lineByCard: Map<string, ShortfallLine>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowse: () => void;
  onPreview: (cardId: string, list: string[]) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  if (analysis.main.length === 0) {
    return (
      <div className={`${panelClass} flex flex-col items-start gap-3 p-4`}>
        <p className="text-sm text-muted">{t("decks.emptyDeck")}</p>
        <button type="button" className={`${primaryClass} lg:hidden`} onClick={onBrowse}>
          {t("decks.addCards")}
        </button>
      </div>
    );
  }
  const known = TYPE_ORDER as readonly string[];
  const groups = [
    ...TYPE_ORDER.filter((type) => type !== "Legend").map((type) => ({
      key: type,
      title: type,
      lines: analysis.main.filter((line) => line.card.cardType === type),
    })),
    { key: "other", title: t("decks.otherCards"), lines: analysis.main.filter((line) => !known.includes(line.card.cardType ?? "")) },
  ].filter((group) => group.lines.length > 0);
  return (
    <section className={panelClass} aria-label={t("decks.mainDeck")}>
      {groups.map((group) => (
        <div key={group.key} className="border-t border-line/60 first:border-t-0">
          <h3 className="hud-label flex justify-between px-3 pt-3 pb-1">
            <span>{group.title}</span>
            <span className="tabular-nums">{fmt.int(group.lines.reduce((sum, line) => sum + line.quantity, 0))}</span>
          </h3>
          <ul className="pb-1.5">
            {group.lines.map((line) => (
              <DeckRow
                key={line.card.id}
                line={line}
                detail={lineByCard.get(line.card.id)}
                ramOk={analysis.legends.length === 0 || ramAllowed(line.card, analysis.ramLimits)}
                canAdd={canAdd(line.card)}
                onQuantity={onQuantity}
                onPreview={() => onPreview(line.card.id, analysis.main.map((entry) => entry.card.id))}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function DeckRow({
  line,
  detail,
  ramOk,
  canAdd,
  onQuantity,
  onPreview,
}: {
  line: DeckLine;
  detail: ShortfallLine | undefined;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onPreview: () => void;
}) {
  const t = useTranslations();
  const label = cardLabel(line.card);
  const owned = detail?.owned ?? 0;
  const ownedTone = owned >= line.quantity ? "bg-gain" : owned > 0 ? "bg-yellow" : "bg-line";
  const problem = !ramOk || !isLegal(line.card) || line.quantity > DECK_RULES.maxCopies;
  return (
    <li className={`flex items-center gap-2 px-3 py-1 hover:bg-panel-2 ${problem ? "text-danger" : ""}`}>
      <span className="w-4 shrink-0 text-right font-mono text-sm tabular-nums text-cyan">{line.quantity}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${colorDotClass(line.card.color)}`} aria-hidden="true" />
      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 truncate text-left text-sm hover:text-cyan"
        title={label}
        aria-label={t("decks.viewCard", { name: label })}
      >
        {label}
      </button>
      <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted" title={line.card.cost != null ? t("decks.cost", { n: line.card.cost }) : undefined}>
        {line.card.cost ?? ""}
      </span>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${ownedTone}`}
        title={t("decks.ownedTitle", { owned, total: line.quantity })}
        aria-label={t("decks.ownedTitle", { owned, total: line.quantity })}
        role="img"
      />
      <Stepper card={line.card} quantity={line.quantity} canAdd={canAdd} onQuantity={onQuantity} compact />
    </li>
  );
}

function CostCurve({ curve }: { curve: number[] }) {
  const t = useTranslations();
  const max = Math.max(1, ...curve);
  return (
    <section className={`${panelClass} p-4`} aria-labelledby="deck-curve">
      <h2 id="deck-curve" className="hud-label">
        {t("decks.curve")}
      </h2>
      <ol className="mt-3 grid h-24 grid-cols-8 items-end gap-1.5">
        {curve.map((count, cost) => (
          <li key={cost} className="flex h-full flex-col items-center justify-end gap-1" aria-label={t("decks.curveBar", { cost: cost === 7 ? "7+" : String(cost), n: count })}>
            <span className="font-mono text-[10px] tabular-nums text-muted">{count || ""}</span>
            <span className="w-full bg-cyan/70" style={{ height: `${(count / max) * 65}%`, minHeight: count ? 2 : 0 }} />
            <span className="font-mono text-[11px] text-muted">{cost === 7 ? "7+" : cost}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
