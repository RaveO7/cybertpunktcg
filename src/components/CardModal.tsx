"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { chipColor } from "@/components/CardTile";
import { RulesText } from "@/components/RulesText";
import { WishlistPanel } from "@/components/WishlistPanel";
import { DesktopAddForm, MobileAddForm, useAddCopyForm } from "@/components/card-modal/AddCopyForm";
import { CardDetails } from "@/components/card-modal/CardDetails";
import { LineEditor, LineReadonly } from "@/components/card-modal/CollectionLines";
import { ModalHeader } from "@/components/card-modal/ModalHeader";
import { PrintingsStrip } from "@/components/card-modal/PrintingsStrip";
import { isTypingTarget, toAmount } from "@/components/card-modal/shared";
import type { CardDTO, CollectionItemDTO, ConditionDTO, Filters, PrintingDTO } from "@/lib/types";
import { thumbnailPath } from "@/lib/card-image";
import { printingTitle, resolveRulesText } from "@/lib/logic";
import { WISHLIST_ENABLED } from "@/lib/site";
import { useModal } from "@/components/use-modal";

// Prix et historique (graphique compris) : chargés à la demande, une fois la fiche ouverte.
const PricePanel = dynamic(() => import("@/components/card-modal/PricePanel").then((module) => module.PricePanel));

/**
 * Télécharge et décode une image hors de la page : affichée ensuite, elle apparaît sans délai.
 * `cancel` abandonne le décodage (carte déjà quittée) pour ne pas retarder les suivantes.
 */
function decodeImage(url: string) {
  const image = new Image();
  image.src = url;
  const ready = image.decode().then(
    () => true,
    () => false,
  );
  return { ready, cancel: () => image.removeAttribute("src") };
}

/**
 * Illustration de la fiche. Une seule balise, jamais remontée : la nouvelle carte (miniature,
 * puis pleine résolution) n'y est placée qu'une fois décodée, sans image noire entre deux cartes,
 * même en maintenant la flèche. Si elle tarde, l'ancienne carte est masquée pour ne pas rester affichée.
 */
function ModalCardImage({ src }: { src: string }) {
  const [shown, setShown] = useState<{ src: string | null; full: boolean }>({ src: null, full: false });

  useEffect(() => {
    let alive = true;
    const thumb = thumbnailPath(src);
    const hideStale = window.setTimeout(() => {
      if (alive) setShown((current) => (current.src === src ? current : { src: null, full: false }));
    }, 150);
    const pending: ReturnType<typeof decodeImage>[] = [];
    const loadFull = () => {
      const full = decodeImage(src);
      pending.push(full);
      void full.ready.then((ok) => {
        if (alive && ok) setShown({ src, full: true });
      });
    };
    // Miniature tout de suite ; pleine résolution seulement si la carte reste affichée.
    const fullTimer = thumb ? window.setTimeout(loadFull, 150) : null;
    if (thumb) {
      const small = decodeImage(thumb);
      pending.push(small);
      void small.ready.then((ok) => {
        if (!alive) return;
        if (ok) setShown((current) => (current.src === src ? current : { src, full: false }));
        // Miniature absente : on passe tout de suite à l'image d'origine.
        else if (fullTimer !== null) {
          window.clearTimeout(fullTimer);
          loadFull();
        }
      });
    } else {
      loadFull();
    }
    return () => {
      alive = false;
      window.clearTimeout(hideStale);
      if (fullTimer !== null) window.clearTimeout(fullTimer);
      for (const image of pending) image.cancel();
    };
  }, [src]);

  const displayed = shown.src && (shown.full ? shown.src : (thumbnailPath(shown.src) ?? shown.src));
  return (
    <div className="aspect-[63/88] w-full overflow-hidden rounded-xl" data-src={src}>
      {displayed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayed} alt="" className="h-full w-full object-contain" />
      ) : null}
    </div>
  );
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
  preloadImages,
  onFilterArtist,
  onFilterRarity,
  onFilterSet,
  onFilter,
  readOnly = false,
  onSave,
  onPatch,
  onDelete,
  pendingIds,
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
  /** Images des cartes précédente / suivante, à mettre en cache d'avance. */
  preloadImages?: string[];
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
    purchasedAt?: string | null;
  }) => Promise<void>;
  onPatch?: (id: string, input: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** Lignes modifiées hors ligne, pas encore envoyées. */
  pendingIds?: ReadonlySet<string>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const formErrorId = useId();
  const form = useAddCopyForm(printing.id, onSave);
  const { setQuantity } = form;
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const title = printingTitle(card, printing);
  const rules = resolveRulesText(card, printing, siblings, locale);
  const accent = chipColor(card.color);
  const canAdd = !readOnly && Boolean(onSave);

  const market = toAmount(printing.marketPrice);

  useModal(overlayRef, { onClose, initialFocus: closeRef });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && prevId) {
        event.preventDefault();
        onOpen(prevId);
        return;
      }
      if (event.key === "ArrowRight" && nextId) {
        event.preventDefault();
        onOpen(nextId);
        return;
      }
      // Flèches haut / bas : quantité du formulaire d'ajout.
      if (!canAdd) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setQuantity((current) => current + 1);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setQuantity((current) => Math.max(1, current - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen, prevId, nextId, canAdd, setQuantity]);

  const preloadKey = preloadImages?.join("|") ?? "";
  useEffect(() => {
    if (!preloadKey) return;
    // Miniatures (légères) pour toutes les voisines, pleine résolution pour les deux plus proches.
    preloadKey.split("|").forEach((src, index) => {
      for (const url of [thumbnailPath(src), index < 2 ? src : null]) {
        if (!url) continue;
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      }
    });
  }, [preloadKey]);

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
      ref={overlayRef}
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
        <ModalHeader
          card={card}
          printing={printing}
          title={title}
          titleId={titleId}
          prevId={prevId}
          nextId={nextId}
          closeRef={closeRef}
          onOpen={onOpen}
          onClose={onClose}
        />

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
                <ModalCardImage src={printing.imagePath} />
              ) : (
                <div
                  className="flex aspect-[63/88] items-center justify-center text-sm text-muted"
                  role="img"
                  aria-label={t("modal.noImage")}
                >
                  {t("modal.noImage")}
                </div>
              )}
            </figure>

            <CardDetails card={card} printing={printing} onFilter={onFilter} onFilterRarity={onFilterRarity} />

            <PrintingsStrip printing={printing} siblings={siblings} ownedIds={ownedIds} titleId={titleId} onOpen={onOpen} />
          </aside>

          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
            <PricePanel printing={printing} items={items} market={market} titleId={titleId} />

            {rules.text ? (
              <div className="order-4 md:order-none">
                <RulesText label={t("modal.rulesText")} text={rules.text} />
              </div>
            ) : null}

            {card.flavorText ? (
              <blockquote className="order-5 border-l-2 md:order-none border-yellow/40 pl-3 text-sm italic leading-relaxed text-muted">
                <span className="sr-only">{t("modal.flavorText")}. </span>
                {card.flavorText}
              </blockquote>
            ) : null}

            <section className="hud-panel order-6 overflow-hidden md:order-none" aria-labelledby={`${titleId}-collection`}>
              <div className="flex items-center justify-between gap-3 border-b border-cyan/15 px-4 py-3 sm:px-5">
                <h3 id={`${titleId}-collection`} className="hud-label text-cyan">
                  {readOnly ? t("filters.collection") : t("modal.myCollection")}
                </h3>
                {items.length === 0 ? <p className="text-xs text-muted">{t("modal.notInCollection")}</p> : null}
              </div>

              {items.length > 0 ? (
                <div className="px-4 pb-1 pt-2 sm:px-5">
                  {canEdit ? (
                    <div
                      className="hidden gap-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted md:grid md:grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_9rem_minmax(0,1fr)_2.75rem]"
                      aria-hidden="true"
                    >
                      <span>{t("modal.condition")}</span>
                      <span>{t("modal.quantity")}</span>
                      <span>{t("modal.unitPurchasePrice")}</span>
                      <span>{t("modal.purchaseDate")}</span>
                      <span>{t("modal.notes")}</span>
                      <span />
                    </div>
                  ) : null}
                  <ul className="flex flex-col">
                    {items.map((item) => (
                      <li
                        key={`${item.id}:${item.conditionCode}:${item.notes ?? ""}:${item.purchasePrice ?? ""}:${item.purchaseCurrency ?? ""}:${item.purchasedAt ?? ""}`}
                        className="border-t border-line/50 py-2.5 first:border-t-0 md:first:border-t"
                      >
                        {pendingIds?.has(item.id) ? (
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-yellow">
                            <span className="size-1.5 bg-yellow" aria-hidden="true" />
                            {t("offline.sync.pendingLine")}
                          </p>
                        ) : null}
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
                <DesktopAddForm form={form} items={items} conditions={conditions} titleId={titleId} formErrorId={formErrorId} />
              ) : null}
            </section>

            {WISHLIST_ENABLED && !readOnly && onSave ? <WishlistPanel printingId={printing.id} marketPrice={market} /> : null}

            <footer className="order-8 flex flex-col gap-1.5 text-[13px] text-muted md:order-none md:flex-row md:flex-wrap md:items-center md:gap-x-7 md:gap-y-2">
              {printing.artist ? (
                <span>
                  {t("modal.artist")} ·{" "}
                  {onFilterArtist ? (
                    <button
                      type="button"
                      className="text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
                      onClick={() => onFilterArtist(printing.artist!)}
                      aria-label={t("modal.viewArtist", { artist: printing.artist })}
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
                  {t("modal.finish")} · <span className="text-foreground">{printing.officialFinish}</span>
                </span>
              ) : null}
              {printing.setName ? (
                <span>
                  {t("modal.set")} ·{" "}
                  {onFilterSet ? (
                    <button
                      type="button"
                      className="text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
                      onClick={() => onFilterSet(printing.setCode)}
                      aria-label={t("modal.viewSet", { set: printing.setName })}
                    >
                      {printing.setName}
                    </button>
                  ) : (
                    <span className="text-foreground">{printing.setName}</span>
                  )}
                </span>
              ) : null}
              <span>
                {t("modal.number")} · <span className="font-mono text-foreground">{printing.collectorNumber}</span>
              </span>
            </footer>
          </div>
        </div>

        {!readOnly && onSave ? <MobileAddForm form={form} conditions={conditions} formErrorId={formErrorId} /> : null}
      </div>
    </div>
  );
}
