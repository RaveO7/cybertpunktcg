"use client";

import type { CSSProperties, MouseEvent } from "react";
import type { CardDTO, PrintingDTO } from "@/lib/types";

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

function nameParts(card: CardDTO | undefined, printing: PrintingDTO) {
  const localized = printing.localizedName?.trim();
  if (localized) {
    const split = localized.split(/\s*[—–]\s*/, 2);
    if (split.length === 2 && split[0] && split[1]) {
      return { name: split[0], subname: split[1] };
    }
    return { name: localized, subname: card?.subname ?? null };
  }
  return {
    name: card?.name || card?.canonicalName || "Carte",
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
}) {
  const { name, subname } = nameParts(card, printing);
  const title = subname ? `${name} — ${subname}` : name;
  const accent = active ? "hud-panel-active" : queued > 0 || ownedQty > 0 ? "hud-panel-owned" : "";
  const chip = chipColor(card?.color);

  return (
    <div className="group relative h-full">
      {printing.imagePath ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 aspect-card" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={printing.imagePath} alt="" role="presentation" draggable={false} className="card-ambilight" />
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] aspect-card overflow-visible"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={printing.imagePath}
              alt=""
              role="presentation"
              draggable={false}
              className="card-ambilight card-ambilight-bottom"
            />
          </div>
        </>
      ) : null}
      <article
        data-card-id={printing.id}
        onContextMenu={onContextMenu}
        className={`no-touch-callout relative z-0 flex h-full flex-col overflow-hidden hud-panel ${accent}`}
      >
        <button type="button" onClick={onClick} className="flex flex-1 flex-col text-left">
          <div
            className={`relative aspect-card overflow-hidden bg-overlay scanlines scanbeam ${
              ownedQty > 0 || queued > 0 ? "" : "opacity-80"
            }`}
          >
            {printing.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={printing.imagePath}
                alt=""
                draggable={false}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
                Image indisponible
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
            <div className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-2 md:gap-x-3">
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
        {queued > 0 ? (
          <div className="absolute right-2 top-2 z-20 flex items-center border border-yellow/80 bg-yellow text-black shadow-[0_0_18px_rgba(252,238,10,0.35)]">
            <button
              type="button"
              className="h-11 w-11 text-lg"
              aria-label={`Retirer un exemplaire de ${title}`}
              onClick={onUnqueue}
            >
              −
            </button>
            <span className="min-w-6 text-center font-mono text-sm">{queued}</span>
            <button
              type="button"
              className="h-11 w-11 text-lg"
              aria-label={`Ajouter un exemplaire de ${title}`}
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
