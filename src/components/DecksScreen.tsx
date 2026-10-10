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
  const [pane, setPane] = useState<"deck" | "add">("deck");
  const [panel, setPanel] = useState<"none" | "export" | "import">("none");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saver = useDeckSaver(deck.id, onSaved);

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
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
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
      {deleteError ? (
        <p role="alert" className="text-sm text-danger">
          {deleteError}
        </p>
      ) : null}

      <label className="block">
        <span className="sr-only">{t.decks.name}</span>
        <input
          className="w-full border-b border-line bg-transparent pb-1 text-2xl text-yellow outline-none focus:border-cyan sm:text-4xl"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>

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

      <ValidationPanel analysis={analysis} />

      {/* Téléphone : un onglet à la fois. Bureau : deck et recherche côte à côte. */}
      <div className="flex border border-line lg:hidden" role="tablist" aria-label={t.decks.title}>
        {(["deck", "add"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={pane === key}
            className={`h-10 flex-1 text-sm ${pane === key ? "bg-yellow text-black" : "text-muted"}`}
            onClick={() => setPane(key)}
          >
            {key === "deck" ? `${t.decks.deckTab} · ${formatInt(analysis.legendCount + analysis.mainCount)}` : t.decks.addCards}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:items-start">
        <div className={`${pane === "deck" ? "flex" : "hidden"} min-w-0 flex-col gap-4 lg:flex`}>
          <DeckSections
            analysis={analysis}
            lineByCard={lineByCard}
            preview={index.preview}
            canAdd={canAdd}
            onQuantity={setQuantity}
            onBrowse={() => setPane("add")}
          />
          {analysis.mainCount > 0 ? <CostCurve curve={analysis.curve} /> : null}
          <DeckRecap shortfall={shortfall} />
        </div>
        <div className={`${pane === "add" ? "flex" : "hidden"} min-w-0 flex-col lg:sticky lg:top-4 lg:flex`}>
          <CardPicker
            pool={index.pool}
            analysis={analysis}
            quantities={quantities}
            owned={owned}
            preview={index.preview}
            canAdd={canAdd}
            onQuantity={setQuantity}
          />
        </div>
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

function ValidationPanel({ analysis }: { analysis: DeckAnalysis }) {
  const { t } = useI18n();
  const legendsOk = analysis.legendCount === DECK_RULES.legends;
  const sizeOk = analysis.mainCount >= DECK_RULES.minCards && analysis.mainCount <= DECK_RULES.maxCards;
  const colors = COLOR_ORDER.filter((color) => analysis.ramLimits[color] != null);
  return (
    <section className="flex flex-col gap-3 border border-line bg-panel p-3 sm:p-4" aria-labelledby="deck-validation">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="deck-validation" className="hud-label mr-1">
          {t.decks.validation}
        </h2>
        <ValidityBadge analysis={analysis} />
        <Check ok={legendsOk} label={`${t.decks.legends} ${analysis.legendCount}/${DECK_RULES.legends}`} />
        <Check ok={sizeOk} label={`${t.decks.mainDeck} ${analysis.mainCount} (${DECK_RULES.minCards}–${DECK_RULES.maxCards})`} />
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
        <ul className="flex flex-col gap-1 text-sm text-danger">
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

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 border px-1.5 font-mono text-[11px] tabular-nums ${
        ok ? "border-gain/45 text-gain" : "border-danger/45 text-danger"
      }`}
    >
      <span aria-hidden="true">{ok ? "✓" : "✕"}</span>
      {label}
    </span>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gain" }) {
  return (
    <div className="flex min-w-0 flex-col justify-between border border-line bg-panel px-3 py-3 sm:px-4">
      <p className="text-[11px] leading-tight tracking-[0.12em] text-muted uppercase sm:text-xs">{label}</p>
      <div className="mt-2">
        <p className={`truncate text-xl sm:text-2xl ${tone === "gain" ? "text-gain" : "text-foreground"}`}>{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function DeckSections({
  analysis,
  lineByCard,
  preview,
  canAdd,
  onQuantity,
  onBrowse,
}: {
  analysis: DeckAnalysis;
  lineByCard: Map<string, ShortfallLine>;
  preview: Map<string, PrintingDTO>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  if (analysis.legends.length === 0 && analysis.main.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 border border-line bg-panel p-5">
        <p className="text-sm text-muted">{t.decks.emptyDeck}</p>
        <button type="button" className={`${primaryClass} lg:hidden`} onClick={onBrowse}>
          {t.decks.addCards}
        </button>
      </div>
    );
  }
  const groups: { key: string; title: string; lines: DeckLine[] }[] = [
    { key: "Legend", title: `${t.decks.legends} · ${analysis.legendCount}/${DECK_RULES.legends}`, lines: analysis.legends },
    ...TYPE_ORDER.filter((type) => type !== "Legend").map((type) => {
      const lines = analysis.main.filter((line) => line.card.cardType === type);
      return { key: type, title: `${type} · ${formatInt(lines.reduce((sum, line) => sum + line.quantity, 0))}`, lines };
    }),
    {
      key: "other",
      title: t.decks.otherCards,
      lines: analysis.main.filter((line) => !(TYPE_ORDER as readonly string[]).includes(line.card.cardType ?? "")),
    },
  ];
  return (
    <>
      {groups
        .filter((group) => group.lines.length > 0 || group.key === "Legend")
        .map((group) => (
          <section key={group.key} className="border border-line bg-panel" aria-label={group.title}>
            <h2 className="hud-label border-b border-line/60 px-3 py-2 sm:px-4">{group.title}</h2>
            {group.lines.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted sm:px-4">{t.decks.noLegends}</p>
            ) : (
              <ul>
                {group.lines.map((line) => (
                  <DeckRow
                    key={line.card.id}
                    line={line}
                    detail={lineByCard.get(line.card.id)}
                    printing={preview.get(line.card.id)}
                    ramOk={isLegend(line.card) || analysis.legends.length === 0 || ramAllowed(line.card, analysis.ramLimits)}
                    canAdd={canAdd(line.card)}
                    onQuantity={onQuantity}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
    </>
  );
}

function CardThumb({ printing }: { printing: PrintingDTO | undefined }) {
  return printing?.imagePath ? (
    <CardImage src={printing.imagePath} alt="" className="h-14 w-10 shrink-0 bg-black object-contain" loading="lazy" />
  ) : (
    <span className="grid h-14 w-10 shrink-0 place-items-center bg-black text-[10px] text-muted">N/A</span>
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
}: {
  card: CardDTO;
  quantity: number;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const label = cardLabel(card);
  const step = "grid h-9 w-9 place-items-center border border-line text-base text-muted hover:border-cyan hover:text-foreground disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted";
  return (
    <span className={wide ? "flex w-full items-center justify-between" : "flex shrink-0 items-center"}>
      <button type="button" className={step} disabled={quantity <= 0} onClick={() => onQuantity(card.id, quantity - 1)} aria-label={t.decks.removeOne(label)}>
        −
      </button>
      <span className="w-8 text-center font-mono text-sm tabular-nums" aria-label={t.decks.inDeck(quantity)}>
        {quantity}
      </span>
      <button type="button" className={step} disabled={!canAdd} onClick={() => onQuantity(card.id, quantity + 1)} aria-label={t.decks.addOne(label)}>
        +
      </button>
    </span>
  );
}

function DeckRow({
  line,
  detail,
  printing,
  ramOk,
  canAdd,
  onQuantity,
}: {
  line: DeckLine;
  detail: ShortfallLine | undefined;
  printing: PrintingDTO | undefined;
  ramOk: boolean;
  canAdd: boolean;
  onQuantity: (cardId: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const label = cardLabel(line.card);
  const owned = detail?.owned ?? 0;
  const href = `/cards?printing=${encodeURIComponent(detail?.cheapestPrintingId ?? printing?.id ?? "")}`;
  return (
    <li className="flex items-center gap-3 border-t border-line/60 px-3 py-2 first:border-t-0 sm:px-4">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:text-cyan" aria-label={t.decks.openCard(label)}>
        <CardThumb printing={printing} />
        <span className="min-w-0">
          <span className="block truncate text-sm">{label}</span>
          <CardFacts card={line.card} ramOk={ramOk} />
        </span>
      </Link>
      <span className="hidden w-24 shrink-0 text-right sm:block">
        <span
          className={`block font-mono text-xs tabular-nums ${owned >= line.quantity ? "text-gain" : "text-muted"}`}
          title={t.decks.ownedTitle(owned, line.quantity)}
        >
          {t.decks.ownedShort(owned, line.quantity)}
        </span>
        {detail && detail.missing > 0 ? (
          <span className="block font-mono text-[11px] text-muted">
            {detail.cost != null ? formatMoney(detail.cost) : t.decks.noPrice}
          </span>
        ) : null}
      </span>
      <Stepper card={line.card} quantity={line.quantity} canAdd={canAdd} onQuantity={onQuantity} />
    </li>
  );
}

function CostCurve({ curve }: { curve: number[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...curve);
  return (
    <section className="border border-line bg-panel p-3 sm:p-4" aria-labelledby="deck-curve">
      <h2 id="deck-curve" className="hud-label">
        {t.decks.curve}
      </h2>
      <ol className="mt-3 grid h-28 grid-cols-8 items-end gap-1.5">
        {curve.map((count, cost) => (
          <li key={cost} className="flex h-full flex-col items-center justify-end gap-1" aria-label={t.decks.curveBar(cost === 7 ? "7+" : String(cost), count)}>
            <span className="font-mono text-[10px] tabular-nums text-muted">{count || ""}</span>
            <span className="w-full bg-cyan/70" style={{ height: `${(count / max) * 70}%`, minHeight: count ? 2 : 0 }} />
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
    <section className="flex flex-col gap-3" aria-labelledby="deck-recap">
      <h2 id="deck-recap" className="hud-label">
        {t.decks.recapTitle}
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                <span className="min-w-0 flex-1 truncate">{cardLabel(line.card)}</span>
                <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted sm:inline">
                  {line.unitPrice != null ? t.decks.priceEach(formatMoney(line.unitPrice)) : ""}
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

const RESULTS_LIMIT = 60;

function CardPicker({
  pool,
  analysis,
  quantities,
  owned,
  preview,
  canAdd,
  onQuantity,
}: {
  pool: CardDTO[];
  analysis: DeckAnalysis;
  quantities: Map<string, number>;
  owned: Map<string, number>;
  preview: Map<string, PrintingDTO>;
  canAdd: (card: CardDTO) => boolean;
  onQuantity: (cardId: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [ramOnly, setRamOnly] = useState(true);
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
  const needle = normalizeText(query);
  const results = pool.filter((card) => {
    if (needle && !haystacks.get(card.id)!.includes(needle)) return false;
    if (colors.length > 0 && !colors.includes(card.color ?? "")) return false;
    if (type && card.cardType !== type) return false;
    if (ownedOnly && !(owned.get(card.id) ?? 0)) return false;
    if (ramOnly && hasLegends && !isLegend(card) && !ramAllowed(card, analysis.ramLimits)) return false;
    return true;
  });
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center gap-1.5 border px-2 text-xs ${active ? "border-cyan bg-cyan/10 text-foreground" : "border-line text-muted hover:text-foreground"}`;

  return (
    <section className="flex min-h-0 flex-col border border-line bg-panel lg:max-h-[calc(100cqh-2rem)]" aria-labelledby="deck-picker">
      <div className="flex flex-col gap-2 border-b border-line/60 p-3">
        <h2 id="deck-picker" className="hud-label">
          {t.decks.addCards}
        </h2>
        <input
          type="search"
          className="h-10 w-full border border-line bg-background px-2.5 text-sm outline-none focus:border-cyan"
          placeholder={t.decks.searchPlaceholder}
          aria-label={t.common.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {COLOR_ORDER.map((color) => {
            const active = colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                aria-pressed={active}
                className={chip(active)}
                onClick={() => setColors(active ? colors.filter((entry) => entry !== color) : [...colors, color])}
              >
                <span className={`h-2 w-2 rounded-full ${colorDotClass(color)}`} aria-hidden="true" />
                {color}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_ORDER.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={type === entry}
              className={chip(type === entry)}
              onClick={() => setType(type === entry ? "" : entry)}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={ownedOnly} onChange={(event) => setOwnedOnly(event.target.checked)} />
            {t.decks.ownedOnly}
          </label>
          <label className="inline-flex items-center gap-1.5" title={hasLegends ? undefined : t.decks.noRam}>
            <input type="checkbox" checked={ramOnly} onChange={(event) => setRamOnly(event.target.checked)} />
            {t.decks.ramOnly}
          </label>
        </div>
      </div>
      <ul className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {results.slice(0, RESULTS_LIMIT).map((card) => {
          const quantity = quantities.get(card.id) ?? 0;
          const ramOk = isLegend(card) || !hasLegends || ramAllowed(card, analysis.ramLimits);
          return (
            <PickerTile
              key={card.id}
              card={card}
              printing={preview.get(card.id)}
              quantity={quantity}
              owned={owned.get(card.id) ?? 0}
              ramOk={ramOk}
              canAdd={canAdd(card)}
              onQuantity={onQuantity}
            />
          );
        })}
        {results.length === 0 ? <li className="col-span-full px-1 py-4 text-sm text-muted">{t.decks.noResults}</li> : null}
        {results.length > RESULTS_LIMIT ? (
          <li className="col-span-full px-1 py-3 text-xs text-muted">{t.decks.moreResults(results.length - RESULTS_LIMIT)}</li>
        ) : null}
      </ul>
    </section>
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
    <li className={`flex min-w-0 flex-col gap-1.5 border p-1.5 ${quantity ? "border-cyan bg-cyan/5" : "border-line/60"}`}>
      {/* Raccourci souris/tactile ; au clavier, le bouton + ci-dessous fait la même chose. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={!canAdd}
        onClick={() => onQuantity(card.id, quantity + 1)}
        className="group relative block w-full cursor-pointer disabled:cursor-not-allowed"
      >
        {printing?.imagePath ? (
          <CardImage
            src={printing.imagePath}
            alt=""
            loading="lazy"
            className={`aspect-[63/88] w-full rounded-md bg-black object-contain transition group-enabled:group-hover:brightness-110 ${
              canAdd || quantity ? "" : "opacity-45"
            }`}
          />
        ) : (
          <span className="grid aspect-[63/88] w-full place-items-center rounded-md bg-black text-xs text-muted">N/A</span>
        )}
        {quantity ? (
          <span className="absolute top-1.5 right-1.5 bg-cyan px-1.5 py-0.5 font-mono text-xs font-semibold text-black">×{quantity}</span>
        ) : null}
        {owned > 0 ? (
          <span className="absolute top-1.5 left-1.5 bg-black/80 px-1.5 py-0.5 font-mono text-[11px] text-gain">✓ {owned}</span>
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
