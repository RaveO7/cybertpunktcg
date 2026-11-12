"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import type { CardDTO, PrintingDTO } from "@/lib/types";
import { CardImage } from "@/components/CardImage";
import { toAmount } from "@/components/card-modal/shared";

export function chipColor(color: string | null | undefined) {
  switch ((color ?? "").toLowerCase()) {
    case "red":
      return "var(--cp-card-red)";
    case "blue":
      return "var(--cp-card-blue)";
    case "green":
      return "var(--cp-card-green)";
    case "yellow":
      return "var(--cp-card-yellow)";
    default:
      return "var(--cyan)";
  }
}

export function colorDotClass(color: string | null | undefined) {
  switch ((color ?? "").toLowerCase()) {
    case "red":
      return "bg-card-red";
    case "blue":
      return "bg-card-blue";
    case "green":
      return "bg-card-green";
    case "yellow":
      return "bg-card-yellow";
    default:
      return "bg-cyan";
  }
}

export function nameParts(card: CardDTO | undefined, printing: PrintingDTO) {
  const localized = printing.localizedName?.trim();
  if (localized) {
    const split = localized.split(/\s*[—–]\s*/, 2);
    if (split.length === 2 && split[0] && split[1]) {
      return { name: split[0], subname: split[1] };
    }
    return { name: localized, subname: card?.subname ?? null };
  }
  return {
    // Sans nom connu : le numéro de collection, identique dans toutes les langues.
    name: card?.name || card?.canonicalName || `#${printing.collectorNumber}`,
    subname: card?.subname ?? null,
  };
}

export function CardTile({
  printing,
  card,
  ownedQty,
  queued,
  active,
  onClick,
  onContextMenu,
  onQueue,
  onUnqueue,
  addMode = false,
  favorite = false,
  favoriteReady = false,
  onToggleFavorite,
  tabIndex,
  pressed,
}: {
  printing: PrintingDTO;
  card: CardDTO | undefined;
  ownedQty: number;
  queued: number;
  active: boolean;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onQueue: () => void;
  onUnqueue: () => void;
  addMode?: boolean;
  favorite?: boolean;
  favoriteReady?: boolean;
  onToggleFavorite?: () => void;
  /** Tabindex mobile de la grille : une seule carte atteinte par Tab. */
  tabIndex?: number;
  /** Mode sélection : la carte est un bouton à bascule (cochée ou non). */
  pressed?: boolean;
}) {
  const t = useTranslations();
  const { name, subname } = nameParts(card, printing);
  const title = subname ? `${name} — ${subname}` : name;
  const accent = active ? "hud-panel-active" : queued > 0 || ownedQty > 0 ? "hud-panel-owned" : "";
  const chip = chipColor(card?.color);
  // Bouton prix en bas à droite, hors mode ajout (ses boutons ♥ et +1 occupent déjà ce coin).
  const showPrice = !addMode && (toAmount(printing.marketPrice) != null || printing.priceGuide != null);

  return (
    <div className="group relative h-full">
      {printing.imagePath ? (
        <>
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <CardImage src={printing.imagePath} alt="" role="presentation" draggable={false} className="card-ambilight" />
          </div>
          <div className="card-ambilight-spill z-[1]" aria-hidden>
            <div className="relative h-full">
              <CardImage src={printing.imagePath} alt="" role="presentation" draggable={false} className="card-ambilight" />
            </div>
          </div>
        </>
      ) : null}
      <article
        data-card-id={printing.id}
        onContextMenu={onContextMenu}
        className={`no-touch-callout relative z-0 flex h-full flex-col overflow-hidden hud-panel ${accent}`}
      >
        <button type="button" onClick={onClick} tabIndex={tabIndex} aria-pressed={pressed} className="flex flex-1 flex-col text-left">
          <div
            className={`relative aspect-card overflow-hidden bg-overlay scanlines scanbeam ${
              ownedQty > 0 || queued > 0 ? "" : "opacity-80"
            }`}
          >
            {printing.imagePath ? (
              <CardImage
                src={printing.imagePath}
                alt=""
                draggable={false}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
                {t("modal.noImage")}
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-2.5 sm:p-3 md:p-4">
            <p className="truncate text-sm font-bold text-white md:text-base">{name}</p>
            {subname ? <p className="mt-0.5 truncate text-xs text-muted md:text-sm">{subname}</p> : null}
            {card?.cardType ? (
              <div className="mt-2 flex items-center gap-1.5 md:mt-3">
                <span className="chip-wrap" style={{ "--chip-color": chip } as CSSProperties}>
                  <span className="chip-cyber">{card.cardType}</span>
                </span>
              </div>
            ) : null}
            {/* Place du bouton prix : la ligne passe à la ligne au lieu de glisser dessous. */}
            <div className={`mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-2 md:gap-x-3 ${showPrice ? "pr-10" : ""}`}>
              {card?.cost != null ? (
                <span className="inline-flex items-center gap-1 hud-label">
                  <span className="opacity-80">COST</span>
                  <span className="text-foreground">{card.cost}</span>
                </span>
              ) : null}
              {card?.power != null ? (
                <span className="inline-flex items-center gap-1 hud-label">
                  <span className="opacity-80">PWR</span>
                  <span className="text-foreground">{card.power}</span>
                </span>
              ) : null}
              {card?.ram != null ? (
                <span className="inline-flex items-center gap-1 hud-label">
                  <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} />
                  <span className="opacity-80">RAM</span>
                  <span className="text-foreground">{card.ram}</span>
                </span>
              ) : null}
            </div>
          </div>
        </button>
        {showPrice ? (
          // Barre sur toute la largeur, bouton calé à droite : l'info-bulle s'y ancre au-dessus, sans sortir de la tuile.
          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-end sm:inset-x-2.5 sm:bottom-2.5 md:inset-x-3 md:bottom-3">
            <PriceHint printing={printing} title={title} tabIndex={tabIndex} />
          </div>
        ) : null}
        {addMode ? (
          <div className="absolute bottom-2 right-2 z-20 flex gap-2 sm:bottom-2.5 sm:right-2.5 md:bottom-3 md:right-3 md:gap-2.5">
            {onToggleFavorite ? (
              <button
                type="button"
                disabled={!favoriteReady}
                aria-pressed={favorite}
                className={`grid h-11 w-11 place-items-center sm:h-12 sm:w-12 md:h-14 md:w-14 border bg-background/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/70 disabled:opacity-50 ${
                  favorite ? "border-danger text-danger" : "border-line text-muted hover:border-danger hover:text-danger"
                }`}
                aria-label={t(favorite ? "cards.removeFavorite" : "cards.addFavorite", { title })}
                title={t(favorite ? "cards.removeFavorite" : "cards.addFavorite", { title })}
                onClick={onToggleFavorite}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 md:h-8 md:w-8"
                  fill={favorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className="grid h-11 w-11 place-items-center sm:h-12 sm:w-12 md:h-14 md:w-14 border border-line bg-background/80 text-muted transition hover:border-yellow hover:text-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/80"
              aria-label={t("cards.queueCopy", { title })}
              title={t("cards.queueCopy", { title })}
              onClick={onQueue}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="5" y="3" width="12" height="17" rx="1" />
                <path d="M11 8.5v6M8 11.5h6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : null}
        {queued > 0 ? (
          <div className="absolute right-2 top-2 z-20 flex items-center border border-yellow/80 bg-yellow text-black shadow-[0_0_18px_rgba(252,238,10,0.35)]">
            <button
              type="button"
              className="h-11 w-11 text-lg"
              aria-label={t("cards.unqueueCopy", { title })}
              onClick={onUnqueue}
            >
              −
            </button>
            <span className="min-w-6 text-center font-mono text-sm">{queued}</span>
            <button
              type="button"
              className="h-11 w-11 text-lg"
              aria-label={t("cards.queueCopy", { title })}
              onClick={onQueue}
            >
              +
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

/**
 * Prix Cardmarket de la carte sans ouvrir sa fiche. L'info-bulle s'affiche au survol de la souris
 * et s'ouvre au clic, au toucher ou au clavier ; un appui ailleurs, Échap ou un appui sur elle la referme.
 */
function PriceHint({ printing, title, tabIndex }: { printing: PrintingDTO; title: string; tabIndex?: number }) {
  const t = useTranslations();
  const fmt = useNumberFormat();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // iOS ne donne pas le focus à un bouton touché (donc pas de blur) : un appui ailleurs referme l'info-bulle.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const money = (value: string | null | undefined) => {
    const amount = toAmount(value);
    return amount == null ? "—" : fmt.money(amount);
  };
  const guide = printing.priceGuide;
  const rows = [
    { label: t("cards.priceLow"), value: guide?.low },
    { label: t("cards.priceAvg"), value: guide?.avg },
    { label: t("cards.priceAvg7"), value: guide?.avg7 },
    { label: t("cards.priceAvg30"), value: guide?.avg30 },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        tabIndex={tabIndex}
        aria-label={t("cards.priceDetails", { title })}
        aria-expanded={open}
        aria-controls={id}
        // Petite icône, zone de toucher de 44 px (pseudo-élément).
        className={`peer/price pointer-events-auto relative grid h-8 w-8 place-items-center border bg-background/85 transition before:absolute before:-inset-1.5 before:content-[''] hover:border-cyan hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70 md:h-9 md:w-9 ${
          open ? "border-cyan text-cyan" : "border-line text-foreground/80"
        }`}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4v16h16" />
          <path d="m7.5 15 3.5-4 3 2.5 4.5-5.5" />
        </svg>
      </button>
      {/* Au-dessus des boutons, calée à droite, jamais plus large que la tuile. */}
      <div
        ref={panelRef}
        id={id}
        className={`absolute inset-x-0 bottom-full mb-2 ml-auto max-w-56 border border-cyan/50 bg-black/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${
          open ? "pointer-events-auto block" : "hidden peer-hover/price:block"
        }`}
        onClick={() => setOpen(false)}
      >
        <p className="hud-label text-cyan">Cardmarket</p>
        <dl className="mt-1.5 space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{row.label}</dt>
              <dd className="whitespace-nowrap font-mono tabular-nums">{money(row.value)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-cyan/20 pt-1.5">
            <dt className="font-semibold">{t("cards.priceTrend")}</dt>
            <dd className="whitespace-nowrap font-mono font-semibold tabular-nums text-yellow">{money(printing.marketPrice)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
