"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { colorDotClass } from "@/components/CardTile";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import {
  DECK_RULES,
  analyzeDeck,
  cardLabel,
  compareDeckLines,
  deckShortfall,
  deckToText,
  isDeckCard,
  isLegal,
  isLegend,
  maxCopies,
  ownedCopiesByCard,
  parseDeckText,
  ramAllowed,
  type DeckAnalysis,
  type DeckEntry,
  type DeckIssue,
  type DeckLine,
  type Shortfall,
  type ShortfallLine,
} from "@/lib/deck-rules";
import type { Messages } from "@/lib/i18n/messages";
import { intlLocale } from "@/lib/i18n/messages";
import { formatInt, formatMoney, normalizeText } from "@/lib/logic";
import { COLOR_ORDER, TYPE_ORDER } from "@/lib/reference-data";
import type { CardDTO, CatalogDTO, DeckDTO, PrintingDTO } from "@/lib/types";

type DeckPatch = { name?: string; cards?: DeckEntry[] };

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  } catch (error) {
    if (!navigator.onLine) throw new Error("Hors ligne : modification impossible pour le moment.");
    throw error;
  }
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) throw new Error("Session expirée. Reconnectez-vous.");
  if (!response.ok) throw new Error(body.error || "Enregistrement impossible.");
  return body;
}

/** Decks du compte : chargés une fois, mis à jour localement après chaque action. */
function useDecks() {
  const { user } = useCollection();
  const userId = user?.id ?? null;
  const [decks, setDecks] = useState<DeckDTO[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/decks", { cache: "no-store" });
        if (!response.ok) throw new Error("decks");
        const body = (await response.json()) as { decks: DeckDTO[] };
        if (!cancelled) {
          setDecks(body.decks);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les decks.");
      } finally {
        if (!cancelled) setLoadedFor(userId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const replace = useCallback((deck: DeckDTO) => {
    setDecks((current) => [deck, ...current.filter((entry) => entry.id !== deck.id)]);
  }, []);

  return {
    ready: Boolean(userId) && loadedFor === userId,
    error,
    decks,
    replace,
    create: async (input: { name?: string; cards?: DeckEntry[] }) => {
      const { deck } = await send<{ deck: DeckDTO }>("/api/decks", { method: "POST", body: JSON.stringify(input) });
      replace(deck);
      return deck;
    },
    remove: async (id: string) => {
      await send(`/api/decks/${id}`, { method: "DELETE" });
      setDecks((current) => current.filter((deck) => deck.id !== id));
    },
  };
}

/** Index du catalogue utiles aux decks (calculés une fois par catalogue). */
function useDeckCatalog(catalog: CatalogDTO | null) {
  return useMemo(() => {
    const cardsById = new Map<string, CardDTO>();
    const printingsByCard = new Map<string, PrintingDTO[]>();
    const preview = new Map<string, PrintingDTO>();
    if (!catalog) return { cardsById, printingsByCard, preview, pool: [] as CardDTO[] };
    for (const card of catalog.cards) cardsById.set(card.id, card);
    for (const printing of catalog.printings) {
      printingsByCard.set(printing.cardId, [...(printingsByCard.get(printing.cardId) ?? []), printing]);
      // Visuel : un tirage anglais avec image de préférence.
      const current = preview.get(printing.cardId);
      const better =
        printing.imagePath && (!current?.imagePath || (current.language !== "en" && printing.language === "en"));
      if (!current || better) preview.set(printing.cardId, printing);
    }
    const pool = catalog.cards.filter(isDeckCard).sort((a, b) => compareDeckLines({ card: a, quantity: 1 }, { card: b, quantity: 1 }));
    return { cardsById, printingsByCard, preview, pool };
  }, [catalog]);
}

export function DecksScreen() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck");
  const { catalog, ready: collectionReady, error: collectionError } = useCollection();
  const decks = useDecks();

  if (collectionError) return <p className="p-6 text-danger">{collectionError}</p>;
  if (decks.error) return <p className="p-6 text-danger">{decks.error}</p>;
  if (!collectionReady || !catalog || !decks.ready) return <p className="p-6 text-muted">{t.common.loading}</p>;

  if (deckId) {
    const deck = decks.decks.find((entry) => entry.id === deckId);
    if (!deck) {
      return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-3 px-3 py-6 sm:px-4">
          <p className="text-sm text-muted">{t.decks.notFound}</p>
          <BackLink />
        </div>
      );
    }
    return <DeckEditor key={deck.id} deck={deck} catalog={catalog} onSaved={decks.replace} onDelete={decks.remove} />;
  }
  return <DeckList decks={decks.decks} catalog={catalog} onCreate={decks.create} onDelete={decks.remove} />;
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link href="/decks" className="inline-flex h-10 items-center gap-1.5 text-sm text-muted hover:text-cyan">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3 5 8l5 5" />
      </svg>
      {t.decks.back}
    </Link>
  );
}

const buttonClass =
  "inline-flex h-10 items-center justify-center gap-1.5 border border-line px-3 text-sm text-muted transition hover:border-cyan hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 disabled:opacity-50";
const primaryClass =
  "inline-flex h-10 items-center justify-center bg-yellow px-4 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50";

/* ------------------------------------------------------------------ Liste des decks */

function DeckList({
  decks,
  catalog,
  onCreate,
  onDelete,
}: {
  decks: DeckDTO[];
  catalog: CatalogDTO;
  onCreate: (input: { name?: string; cards?: DeckEntry[] }) => Promise<DeckDTO>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { items } = useCollection();
  const { cardsById, printingsByCard } = useDeckCatalog(catalog);
  const owned = useMemo(() => ownedCopiesByCard(items, catalog.printings), [items, catalog.printings]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.decks.failed);
    } finally {
      setPending(false);
    }
  }

  const create = () =>
    run(async () => {
      const deck = await onCreate({ name: t.decks.defaultName });
      router.push(`/decks?deck=${encodeURIComponent(deck.id)}`);
    });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-yellow sm:text-4xl">{t.decks.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t.decks.subtitle}</p>
        </div>
        <button type="button" className={primaryClass} disabled={pending} onClick={() => void create()}>
          {t.decks.newDeck}
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}

      {decks.length === 0 ? (
        <p className="border border-line bg-panel p-5 text-sm text-muted">{t.decks.empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const analysis = analyzeDeck(deck.cards, cardsById);
            const shortfall = deckShortfall([...analysis.legends, ...analysis.main], printingsByCard, owned);
            return (
              <DeckSummaryCard
                key={deck.id}
                deck={deck}
                analysis={analysis}
                shortfall={shortfall}
                updated={dateFormat.format(new Date(deck.updatedAt))}
                pending={pending}
                onDuplicate={() =>
                  void run(async () => {
                    await onCreate({ name: t.decks.copyName(deck.name).slice(0, 60), cards: deck.cards });
                  })
                }
                onDelete={() => void run(() => onDelete(deck.id))}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DeckSummaryCard({
  deck,
  analysis,
  shortfall,
  updated,
  pending,
  onDuplicate,
  onDelete,
}: {
  deck: DeckDTO;
  analysis: DeckAnalysis;
  shortfall: Shortfall;
  updated: string;
  pending: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-col gap-3 border border-line bg-panel p-4">
      <Link
        href={`/decks?deck=${encodeURIComponent(deck.id)}`}
        className="flex min-w-0 flex-col gap-2 hover:text-cyan"
        aria-label={t.decks.open(deck.name)}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-lg">{deck.name}</span>
          <ValidityBadge analysis={analysis} />
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {analysis.legends.length > 0 ? (
            analysis.legends.map(({ card }) => (
              <span key={card.id} className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
                {card.name}
              </span>
            ))
          ) : (
            <span>{t.decks.noLegends}</span>
          )}
        </span>
      </Link>
      <dl className="grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-xs">
        <div>
          <dt className="hud-label">{t.decks.mainDeck}</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatInt(analysis.mainCount)}</dd>
        </div>
        <div>
          <dt className="hud-label">{t.decks.owned}</dt>
          <dd className="mt-1 font-mono tabular-nums">
            {formatInt(shortfall.ownedCopies)}/{formatInt(shortfall.totalCopies)}
          </dd>
        </div>
        <div>
          <dt className="hud-label">{t.decks.toBuy}</dt>
          <dd className={`mt-1 font-mono tabular-nums ${shortfall.missingCopies === 0 && shortfall.totalCopies > 0 ? "text-gain" : ""}`}>
            {shortfall.missingCopies === 0 ? "—" : formatMoney(shortfall.missingCost)}
          </dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{t.decks.updated(updated)}</span>
        <span className="flex gap-2">
          <button type="button" className={`${buttonClass} h-8 px-2 text-xs`} disabled={pending} onClick={onDuplicate}>
            {t.decks.duplicate}
          </button>
          {confirming ? (
            <button
              type="button"
              className={`${buttonClass} h-8 border-danger px-2 text-xs text-danger hover:border-danger hover:text-danger`}
              disabled={pending}
              onClick={onDelete}
              onBlur={() => setConfirming(false)}
              autoFocus
            >
              {t.decks.confirmDelete}
            </button>
          ) : (
            <button type="button" className={`${buttonClass} h-8 px-2 text-xs`} disabled={pending} onClick={() => setConfirming(true)}>
              {t.decks.delete}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

function ValidityBadge({ analysis }: { analysis: DeckAnalysis }) {
  const { t } = useI18n();
  return analysis.valid ? (
    <span className="inline-flex h-6 shrink-0 items-center border border-gain/45 bg-gain/10 px-1.5 text-[11px] text-gain">
      {t.decks.valid}
    </span>
  ) : (
    <span className="inline-flex h-6 shrink-0 items-center border border-danger/45 bg-danger/10 px-1.5 text-[11px] text-danger">
      {t.decks.issueCount(analysis.issues.length)}
    </span>
  );
}

/* ------------------------------------------------------------------ Éditeur */

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Enregistrement automatique : les modifications sont regroupées (600 ms), une seule requête
 * à la fois, et la dernière version part même si l'on quitte la page entre-temps.
 */
function useDeckSaver(deckId: string, onSaved: (deck: DeckDTO) => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<DeckPatch | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Les modifications arrivées pendant une requête partent juste après.
      while (pending.current) {
        const body: DeckPatch = pending.current;
        pending.current = null;
        setStatus("saving");
        try {
          const { deck } = await send<{ deck: DeckDTO }>(`/api/decks/${deckId}`, { method: "PATCH", body: JSON.stringify(body) });
          onSavedRef.current(deck);
          setError(null);
          setStatus("saved");
        } catch (reason) {
          // On garde la modification pour « Réessayer », fusionnée avec les plus récentes.
          pending.current = { ...body, ...(pending.current ?? {}) };
          setError(reason instanceof Error ? reason.message : null);
          setStatus("error");
          return;
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [deckId]);

  const queue = useCallback(
    (patch: DeckPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current && !inFlight.current) {
        void fetch(`/api/decks/${deckId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pending.current),
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [deckId],
  );

  return { status, error, queue, retry: flush };
}

type BrowserFilters = { query: string; colors: string[]; type: string; ownedOnly: boolean; ramOnly: boolean };

const DEFAULT_FILTERS: BrowserFilters = { query: "", colors: [], type: "", ownedOnly: false, ramOnly: true };

/**
 * Éditeur : à gauche (bureau) les cartes à ajouter, qui défilent avec la page ; à droite le deck,
 * collé en haut. Sur écran tactile et téléphone, aucune zone ne défile dans une autre.
 */
function DeckEditor({
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
  const { t } = useI18n();
  const router = useRouter();
  const { items } = useCollection();
  const index = useDeckCatalog(catalog);
  const owned = useMemo(() => ownedCopiesByCard(items, catalog.printings), [items, catalog.printings]);
  const [name, setName] = useState(deck.name);
  const [entries, setEntries] = useState<DeckEntry[]>(deck.cards);
  const [pane, setPane] = useState<"deck" | "add">(deck.cards.length > 0 ? "deck" : "add");
  const [panel, setPanel] = useState<"none" | "export" | "import">("none");
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

  /** Une carte de plus est-elle permise ? (copies max, 3 Legends aux noms différents) */
  const canAdd = (card: CardDTO) => {
    const quantity = quantities.get(card.id) ?? 0;
    if (quantity >= maxCopies(card)) return false;
    if (!isLegend(card)) return true;
    if (analysis.legendCount >= DECK_RULES.legends) return false;
    return !analysis.legends.some((line) => line.card.name === card.name);
  };

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
      setDeleteError(error instanceof Error ? error.message : t.decks.failed);
    }
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4 px-3 pt-3 pb-8 sm:px-5 lg:pt-5">
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
              {t.decks.import}
            </button>
            <button
              type="button"
              className={buttonClass}
              aria-expanded={panel === "export"}
              onClick={() => setPanel(panel === "export" ? "none" : "export")}
            >
              {t.decks.export}
            </button>
            {confirmDelete ? (
              <button
                type="button"
                className={`${buttonClass} border-danger text-danger hover:border-danger hover:text-danger`}
                onClick={() => void remove()}
                onBlur={() => setConfirmDelete(false)}
                autoFocus
              >
                {t.decks.confirmDelete}
              </button>
            ) : (
              <button type="button" className={buttonClass} onClick={() => setConfirmDelete(true)}>
                {t.decks.delete}
              </button>
            )}
          </span>
        </div>
        <label className="block">
          <span className="sr-only">{t.decks.name}</span>
          <input
            className="w-full border-b border-transparent bg-transparent pb-1 text-2xl text-yellow outline-none hover:border-line focus:border-cyan sm:text-3xl"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        {deleteError ? (
          <p role="alert" className="text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
      </header>

      {panel === "export" ? <ExportPanel lines={allLines} onClose={() => setPanel("none")} /> : null}
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
      <div className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:-mx-5 sm:px-5 lg:hidden">
        <div className="flex border border-line" role="tablist" aria-label={t.decks.title}>
          {(["deck", "add"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              className={`flex h-11 flex-1 items-center justify-center gap-2 text-sm ${pane === key ? "bg-yellow text-black" : "text-muted"}`}
              onClick={() => setPane(key)}
            >
              {key === "deck" ? (
                <>
                  {t.decks.deckTab}
                  <span className="font-mono tabular-nums">
                    {formatInt(analysis.legendCount + analysis.mainCount)}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${analysis.valid ? "bg-gain" : "bg-danger"}`} aria-hidden="true" />
                </>
              ) : (
                t.decks.addCards
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section
          ref={browserRef}
          aria-labelledby="deck-picker"
          className={`${pane === "add" ? "block" : "hidden"} min-w-0 scroll-mt-16 lg:block lg:scroll-mt-0`}
        >
          <CardBrowser
            pool={index.pool}
            filters={filters}
            onFilters={setFilters}
            analysis={analysis}
            quantities={quantities}
            owned={owned}
            preview={index.preview}
            canAdd={canAdd}
            onQuantity={setQuantity}
          />
        </section>
        <aside
          aria-label={t.decks.deckTab}
          className={`${pane === "deck" ? "flex" : "hidden"} scrollbar-hud min-w-0 flex-col gap-4 lg:flex lg:pointer-fine:sticky lg:pointer-fine:top-0 lg:pointer-fine:max-h-[100cqh] lg:pointer-fine:overflow-y-auto lg:pointer-fine:py-5 lg:pointer-fine:pr-1`}
        >
          <DeckOverview analysis={analysis} preview={index.preview} onQuantity={setQuantity} onBrowseLegends={browseLegends} />
          <DeckCardList
            analysis={analysis}
            lineByCard={lineByCard}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onBrowse={() => setPane("add")}
          />
          {analysis.mainCount > 0 ? <CostCurve curve={analysis.curve} /> : null}
          <DeckRecap shortfall={shortfall} />
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <span role="alert" className="flex items-center gap-2 text-xs text-danger">
        {error ?? t.decks.saveFailed}
        <button type="button" className="underline hover:text-foreground" onClick={onRetry}>
          {t.decks.retry}
        </button>
      </span>
    );
  }
  return (
    <span className="text-xs text-muted" aria-live="polite">
      {status === "saving" ? t.decks.saving : t.decks.saved}
    </span>
  );
}

function issueText(t: Messages, issue: DeckIssue) {
  switch (issue.code) {
    case "legend-count":
      return t.decks.issueLegendCount(issue.count);
    case "legend-name":
      return t.decks.issueLegendName(issue.name);
    case "deck-size":
      return t.decks.issueDeckSize(issue.count);
    case "copies":
      return t.decks.issueCopies(issue.name, issue.quantity);
    case "ram":
      return t.decks.issueRam(issue.name, issue.ram, issue.color, issue.limit);
    case "not-legal":
      return t.decks.issueNotLegal(issue.name);
    case "unknown":
      return t.decks.issueUnknown;
  }
}

const panelClass = "border border-line bg-panel";

/** En-tête du deck : légalité, 3 emplacements de Legends, RAM par couleur et problèmes. */
function DeckOverview({
  analysis,
  preview,
  onQuantity,
  onBrowseLegends,
}: {
  analysis: DeckAnalysis;
  preview: Map<string, PrintingDTO>;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowseLegends: () => void;
}) {
  const { t } = useI18n();
  const sizeOk = analysis.mainCount >= DECK_RULES.minCards && analysis.mainCount <= DECK_RULES.maxCards;
  const colors = COLOR_ORDER.filter((color) => analysis.ramLimits[color] != null);
  const slots = Array.from({ length: Math.max(DECK_RULES.legends, analysis.legends.length) }, (_, position) => analysis.legends[position]);
  return (
    <section className={`${panelClass} flex flex-col gap-4 p-4`} aria-labelledby="deck-validation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="deck-validation" className="hud-label">
            {t.decks.validation}
          </h2>
          <p className="mt-1 font-mono text-3xl tabular-nums">
            <span className={sizeOk ? "text-gain" : "text-foreground"}>{formatInt(analysis.mainCount)}</span>
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
          {t.decks.legends} · {analysis.legendCount}/{DECK_RULES.legends}
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {slots.map((line, position) =>
            line ? (
              <li key={line.card.id} className="relative min-w-0">
                {preview.get(line.card.id)?.imagePath ? (
                  <CardImage
                    src={preview.get(line.card.id)!.imagePath!}
                    alt=""
                    className="aspect-[63/88] w-full rounded-md bg-black object-contain"
                  />
                ) : (
                  <span className="grid aspect-[63/88] w-full place-items-center rounded-md bg-black text-xs text-muted">N/A</span>
                )}
                <button
                  type="button"
                  onClick={() => onQuantity(line.card.id, line.quantity - 1)}
                  className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/80 text-sm text-foreground hover:bg-danger"
                  aria-label={t.decks.removeOne(cardLabel(line.card))}
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
              {t.decks.ramLimit(color, analysis.ramLimits[color])}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted">{t.decks.noRam}</span>
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

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gain" }) {
  return (
    <div className="flex min-w-0 flex-col justify-between border border-line bg-panel px-3 py-2.5">
      <p className="text-[10px] leading-tight tracking-[0.12em] text-muted uppercase">{label}</p>
      <div className="mt-1.5">
        <p className={`truncate text-lg ${tone === "gain" ? "text-gain" : "text-foreground"}`}>{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[10px] text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Cartes du deck hors Legends, groupées par type, en lignes compactes. */
function DeckCardList({
  analysis,
  lineByCard,
  canAdd,
  onQuantity,
  onBrowse,
}: {
  analysis: DeckAnalysis;
  lineByCard: Map<string, ShortfallLine>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  if (analysis.main.length === 0) {
    return (
      <div className={`${panelClass} flex flex-col items-start gap-3 p-4`}>
        <p className="text-sm text-muted">{t.decks.emptyDeck}</p>
        <button type="button" className={`${primaryClass} lg:hidden`} onClick={onBrowse}>
          {t.decks.addCards}
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
    { key: "other", title: t.decks.otherCards, lines: analysis.main.filter((line) => !known.includes(line.card.cardType ?? "")) },
  ].filter((group) => group.lines.length > 0);
  return (
    <section className={panelClass} aria-label={t.decks.mainDeck}>
      {groups.map((group) => (
        <div key={group.key} className="border-t border-line/60 first:border-t-0">
          <h3 className="hud-label flex justify-between px-3 pt-3 pb-1">
            <span>{group.title}</span>
            <span className="tabular-nums">{formatInt(group.lines.reduce((sum, line) => sum + line.quantity, 0))}</span>
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
}: {
  line: DeckLine;
  detail: ShortfallLine | undefined;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const label = cardLabel(line.card);
  const owned = detail?.owned ?? 0;
  const ownedTone = owned >= line.quantity ? "bg-gain" : owned > 0 ? "bg-yellow" : "bg-line";
  const problem = !ramOk || !isLegal(line.card) || line.quantity > DECK_RULES.maxCopies;
  return (
    <li className={`flex items-center gap-2 px-3 py-1 hover:bg-panel-2 ${problem ? "text-danger" : ""}`}>
      <span className="w-4 shrink-0 text-right font-mono text-sm tabular-nums text-cyan">{line.quantity}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${colorDotClass(line.card.color)}`} aria-hidden="true" />
      <Link
        href={`/cards?printing=${encodeURIComponent(detail?.cheapestPrintingId ?? "")}`}
        className="min-w-0 flex-1 truncate text-sm hover:text-cyan"
        title={label}
        aria-label={t.decks.openCard(label)}
      >
        {label}
      </Link>
      <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted" title={line.card.cost != null ? t.decks.cost(line.card.cost) : undefined}>
        {line.card.cost ?? ""}
      </span>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${ownedTone}`}
        title={t.decks.ownedTitle(owned, line.quantity)}
        aria-label={t.decks.ownedTitle(owned, line.quantity)}
        role="img"
      />
      <Stepper card={line.card} quantity={line.quantity} canAdd={canAdd} onQuantity={onQuantity} compact />
    </li>
  );
}

function CardFacts({ card, ramOk }: { card: CardDTO; ramOk: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
        {card.color ?? "—"}
      </span>
      {card.cost != null ? <span>{t.decks.cost(card.cost)}</span> : null}
      {card.ram != null ? <span className={ramOk ? "" : "text-danger"}>{t.decks.ram(card.ram)}</span> : null}
      {!isLegal(card) ? <span className="text-danger">{t.decks.notLegal}</span> : null}
    </span>
  );
}

function Stepper({
  card,
  quantity,
  canAdd,
  onQuantity,
  wide = false,
  compact = false,
}: {
  card: CardDTO;
  quantity: number;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  wide?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const label = cardLabel(card);
  const size = compact ? "h-7 w-7 text-sm" : "h-9 w-9 text-base";
  const step = `grid ${size} place-items-center border border-line text-muted hover:border-cyan hover:text-foreground disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted`;
  return (
    <span className={wide ? "flex w-full items-center justify-between" : "flex shrink-0 items-center"}>
      <button type="button" className={step} disabled={quantity <= 0} onClick={() => onQuantity(card.id, quantity - 1)} aria-label={t.decks.removeOne(label)}>
        −
      </button>
      {compact ? null : (
        <span className="w-8 text-center font-mono text-sm tabular-nums" aria-label={t.decks.inDeck(quantity)}>
          {quantity}
        </span>
      )}
      <button
        type="button"
        className={`${step} ${compact ? "-ml-px" : ""}`}
        disabled={!canAdd}
        onClick={() => onQuantity(card.id, quantity + 1)}
        aria-label={t.decks.addOne(label)}
      >
        +
      </button>
    </span>
  );
}

function CostCurve({ curve }: { curve: number[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...curve);
  return (
    <section className={`${panelClass} p-4`} aria-labelledby="deck-curve">
      <h2 id="deck-curve" className="hud-label">
        {t.decks.curve}
      </h2>
      <ol className="mt-3 grid h-24 grid-cols-8 items-end gap-1.5">
        {curve.map((count, cost) => (
          <li key={cost} className="flex h-full flex-col items-center justify-end gap-1" aria-label={t.decks.curveBar(cost === 7 ? "7+" : String(cost), count)}>
            <span className="font-mono text-[10px] tabular-nums text-muted">{count || ""}</span>
            <span className="w-full bg-cyan/70" style={{ height: `${(count / max) * 65}%`, minHeight: count ? 2 : 0 }} />
            <span className="font-mono text-[11px] text-muted">{cost === 7 ? "7+" : cost}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Récapitulatif en fin de deck : manquantes, prix du deck complet, reste à acheter et liste d'achat. */
function DeckRecap({ shortfall }: { shortfall: Shortfall }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<boolean | null>(null);
  if (shortfall.totalCopies === 0) return null;
  const missing = shortfall.lines.filter((line) => line.missing > 0).sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1));
  const complete = missing.length === 0;
  const text = missing.map((line) => `${line.missing} ${cardLabel(line.card)}`).join("\n");
  return (
    <section className="flex flex-col gap-2" aria-labelledby="deck-recap">
      <h2 id="deck-recap" className="hud-label">
        {t.decks.recapTitle}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t.decks.missingCards}
          value={`${formatInt(shortfall.missingCopies)}/${formatInt(shortfall.totalCopies)}`}
          tone={complete ? "gain" : undefined}
        />
        <Stat
          label={t.decks.deckCost}
          value={formatMoney(shortfall.deckCost)}
          hint={shortfall.deckUnpricedCopies > 0 ? t.decks.unpriced(shortfall.deckUnpricedCopies) : undefined}
        />
        <Stat
          label={t.decks.toBuy}
          value={complete ? t.decks.complete : formatMoney(shortfall.missingCost)}
          hint={shortfall.unpricedCopies > 0 ? t.decks.unpriced(shortfall.unpricedCopies) : undefined}
          tone={complete ? "gain" : undefined}
        />
      </div>
      {complete ? (
        <p className="border border-gain/45 bg-gain/10 px-3 py-2 text-sm text-gain sm:px-4">{t.decks.allOwned}</p>
      ) : (
        <div className="border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-2 sm:px-4">
            <h3 className="hud-label">
              {t.decks.missingTitle} · {formatInt(shortfall.missingCopies)}
            </h3>
            <span className="ml-auto flex items-center gap-2">
              {copied != null ? (
                <span className={`text-xs ${copied ? "text-gain" : "text-danger"}`} aria-live="polite">
                  {copied ? t.decks.copied : t.decks.copyFailed}
                </span>
              ) : null}
              <button type="button" className={`${buttonClass} h-8 px-2 text-xs`} onClick={() => void copyText(text).then(setCopied)}>
                {t.decks.copyList}
              </button>
            </span>
          </div>
          <ul className="text-sm">
            {missing.map((line) => (
              <li key={line.card.id} className="flex items-center gap-3 border-t border-line/40 px-3 py-1.5 first:border-t-0 sm:px-4">
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted">×{line.missing}</span>
                <span
                  className="min-w-0 flex-1 truncate"
                  title={line.unitPrice != null ? `${cardLabel(line.card)} · ${t.decks.priceEach(formatMoney(line.unitPrice))}` : cardLabel(line.card)}
                >
                  {cardLabel(line.card)}
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
                  {line.cost != null ? formatMoney(line.cost) : t.decks.noPrice}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between gap-3 border-t border-line/60 px-3 py-2 text-sm sm:px-4">
            <span className="text-[11px] text-muted">{t.decks.missingHint}</span>
            <span className="font-mono tabular-nums">{formatMoney(shortfall.missingCost)}</span>
          </p>
        </div>
      )}
    </section>
  );
}

function ExportPanel({ lines, onClose }: { lines: DeckLine[]; onClose: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<boolean | null>(null);
  const text = deckToText(lines);
  return (
    <section className="flex flex-col gap-2 border border-line bg-panel p-3 sm:p-4" aria-label={t.decks.export}>
      <textarea
        readOnly
        value={text}
        rows={Math.min(12, Math.max(3, lines.length))}
        className="w-full resize-y border border-line bg-background p-2 font-mono text-xs outline-none focus:border-cyan"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex items-center gap-2">
        <button type="button" className={primaryClass} disabled={!text} onClick={() => void copyText(text).then(setCopied)}>
          {t.decks.copyList}
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          {t.decks.close}
        </button>
        {copied != null ? (
          <span className={`text-xs ${copied ? "text-gain" : "text-danger"}`} aria-live="polite">
            {copied ? t.decks.copied : t.decks.copyFailed}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function ImportPanel({ cards, onApply, onClose }: { cards: CardDTO[]; onApply: (entries: DeckEntry[]) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseDeckText(text, cards) : null), [text, cards]);
  return (
    <section className="flex flex-col gap-2 border border-line bg-panel p-3 sm:p-4" aria-labelledby="deck-import">
      <h2 id="deck-import" className="hud-label">
        {t.decks.importTitle}
      </h2>
      <p className="text-xs text-muted">{t.decks.importHint}</p>
      <textarea
        value={text}
        rows={8}
        placeholder={"3 V: Streetkid\n3 Japantown Jonin"}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y border border-line bg-background p-2 font-mono text-xs outline-none focus:border-cyan"
      />
      {parsed && parsed.unmatched.length > 0 ? (
        <div className="text-xs text-danger" role="status">
          <p>{t.decks.importUnmatched(parsed.unmatched.length)}</p>
          <ul className="mt-1 list-inside list-disc font-mono">
            {parsed.unmatched.slice(0, 8).map((line, position) => (
              <li key={position}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primaryClass}
          disabled={!parsed || parsed.entries.length === 0}
          onClick={() => parsed && onApply(parsed.entries)}
        >
          {parsed ? t.decks.importApply(parsed.entries.reduce((sum, entry) => sum + entry.quantity, 0)) : t.decks.importApply(0)}
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          {t.decks.cancel}
        </button>
      </div>
    </section>
  );
}

const PAGE_SIZE = 60;

/** Cartes à ajouter : barre de filtres (collée en haut sur bureau) et grille d'images qui défile avec la page. */
function CardBrowser({
  pool,
  filters,
  onFilters,
  analysis,
  quantities,
  owned,
  preview,
  canAdd,
  onQuantity,
}: {
  pool: CardDTO[];
  filters: BrowserFilters;
  onFilters: (filters: BrowserFilters) => void;
  analysis: DeckAnalysis;
  quantities: Map<string, number>;
  owned: Map<string, number>;
  preview: Map<string, PrintingDTO>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const haystacks = useMemo(
    () =>
      new Map(
        pool.map((card) => [
          card.id,
          normalizeText([cardLabel(card), card.rulesText ?? "", ...card.tags, ...card.keywords].join(" ")),
        ]),
      ),
    [pool],
  );
  const hasLegends = analysis.legends.length > 0;
  const needle = normalizeText(filters.query);
  const results = pool.filter((card) => {
    if (needle && !haystacks.get(card.id)!.includes(needle)) return false;
    if (filters.colors.length > 0 && !filters.colors.includes(card.color ?? "")) return false;
    if (filters.type && card.cardType !== filters.type) return false;
    if (filters.ownedOnly && !(owned.get(card.id) ?? 0)) return false;
    if (filters.ramOnly && hasLegends && !isLegend(card) && !ramAllowed(card, analysis.ramLimits)) return false;
    return true;
  });
  // Nouveau filtre : on repart de la première page de résultats.
  const [syncedFilters, setSyncedFilters] = useState(filters);
  if (syncedFilters !== filters) {
    setSyncedFilters(filters);
    setLimit(PAGE_SIZE);
  }
  const update = (patch: Partial<BrowserFilters>) => onFilters({ ...filters, ...patch });
  const chip = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 border px-2.5 text-xs transition ${
      active ? "border-cyan bg-cyan/10 text-foreground" : "border-line text-muted hover:border-muted hover:text-foreground"
    }`;

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line bg-background pb-3 lg:sticky lg:top-0 lg:z-10 lg:pt-5">
        <div className="flex items-center gap-3">
          <h2 id="deck-picker" className="sr-only">
            {t.decks.addCards}
          </h2>
          <input
            type="search"
            className="h-11 min-w-0 flex-1 border border-line bg-panel px-3 text-sm outline-none focus:border-cyan"
            placeholder={t.decks.searchPlaceholder}
            aria-label={t.common.search}
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
          />
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted" aria-live="polite">
            {t.decks.resultCount(results.length)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_ORDER.map((color) => {
            const active = filters.colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                aria-pressed={active}
                className={chip(active)}
                onClick={() => update({ colors: active ? filters.colors.filter((entry) => entry !== color) : [...filters.colors, color] })}
              >
                <span className={`h-2 w-2 rounded-full ${colorDotClass(color)}`} aria-hidden="true" />
                {color}
              </button>
            );
          })}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          {TYPE_ORDER.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={filters.type === entry}
              className={chip(filters.type === entry)}
              onClick={() => update({ type: filters.type === entry ? "" : entry })}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <label className="inline-flex min-h-8 items-center gap-2">
            <input type="checkbox" checked={filters.ownedOnly} onChange={(event) => update({ ownedOnly: event.target.checked })} />
            {t.decks.ownedOnly}
          </label>
          <label className="inline-flex min-h-8 items-center gap-2" title={hasLegends ? undefined : t.decks.noRam}>
            <input type="checkbox" checked={filters.ramOnly} onChange={(event) => update({ ramOnly: event.target.checked })} />
            {t.decks.ramOnly}
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-sm text-muted">{t.decks.noResults}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4 pt-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {results.slice(0, limit).map((card) => (
            <PickerTile
              key={card.id}
              card={card}
              printing={preview.get(card.id)}
              quantity={quantities.get(card.id) ?? 0}
              owned={owned.get(card.id) ?? 0}
              ramOk={isLegend(card) || !hasLegends || ramAllowed(card, analysis.ramLimits)}
              canAdd={canAdd(card)}
              onQuantity={onQuantity}
            />
          ))}
        </ul>
      )}
      {results.length > limit ? (
        <div className="flex justify-center pt-5">
          <button type="button" className={buttonClass} onClick={() => setLimit(limit + PAGE_SIZE)}>
            {t.decks.showMore(results.length - limit)}
          </button>
        </div>
      ) : null}
    </>
  );
}

/** Carte de la recherche, en grand : un clic sur l'image ajoute un exemplaire. */
function PickerTile({
  card,
  printing,
  quantity,
  owned,
  ramOk,
  canAdd,
  onQuantity,
}: {
  card: CardDTO;
  printing: PrintingDTO | undefined;
  quantity: number;
  owned: number;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const label = cardLabel(card);
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      {/* Raccourci souris/tactile ; au clavier, le bouton + ci-dessous fait la même chose. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={!canAdd}
        onClick={() => onQuantity(card.id, quantity + 1)}
        className={`group relative block w-full cursor-pointer rounded-lg ring-2 transition disabled:cursor-not-allowed ${
          quantity ? "ring-cyan" : "ring-transparent enabled:hover:ring-line"
        }`}
      >
        {printing?.imagePath ? (
          <CardImage
            src={printing.imagePath}
            alt=""
            loading="lazy"
            className={`aspect-[63/88] w-full rounded-lg bg-black object-contain ${canAdd || quantity ? "" : "opacity-40"}`}
          />
        ) : (
          <span className="grid aspect-[63/88] w-full place-items-center rounded-lg bg-black text-xs text-muted">N/A</span>
        )}
        {quantity ? (
          <span className="absolute top-2 right-2 bg-cyan px-1.5 py-0.5 font-mono text-xs font-semibold text-black">×{quantity}</span>
        ) : null}
        {owned > 0 ? (
          <span className="absolute top-2 left-2 bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-gain">✓ {owned}</span>
        ) : null}
      </button>
      <span className="line-clamp-2 min-h-[2.5em] text-xs leading-tight" title={label}>
        {label}
      </span>
      <CardFacts card={card} ramOk={ramOk} />
      {owned > 0 ? <span className="sr-only">{t.decks.ownedCount(owned)}</span> : null}
      <Stepper card={card} quantity={quantity} canAdd={canAdd} onQuantity={onQuantity} wide />
    </li>
  );
}
