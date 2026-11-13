"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { colorDotClass } from "@/components/CardTile";
import { ICONIC_GRADIENT_SOFT, isIconicRarity, rarityColor } from "@/lib/rarity-color";
import type { CardDTO, Filters, PrintingDTO } from "@/lib/types";

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

/** Pastilles de la carte (couleur, type, rareté, statistiques, tags, eddies) : chacune filtre le catalogue. */
export function CardDetails({
  card,
  printing,
  onFilter,
  onFilterRarity,
}: {
  card: CardDTO;
  printing: PrintingDTO;
  onFilter?: (patch: Partial<Filters>) => void;
  onFilterRarity?: (rarity: string) => void;
}) {
  const t = useTranslations();
  const stats = [
    card.cost != null ? { key: "costs", label: t("filters.cost"), value: String(card.cost) } : null,
    card.power != null ? { key: "powers", label: t("filters.power"), value: String(card.power) } : null,
    card.ram != null ? { key: "rams", label: t("filters.ram"), value: String(card.ram) } : null,
  ].filter((entry): entry is { key: "costs" | "powers" | "rams"; label: string; value: string } => entry != null);
  const filterOn = (patch: Partial<Filters>) => (onFilter ? () => onFilter(patch) : undefined);
  if (!(printing.rarity || card.color || card.cardType || stats.length > 0 || card.tags.length > 0 || card.isEddiable != null)) {
    return null;
  }
  return (
    <div className="order-3 flex flex-wrap items-center gap-1 md:order-none" aria-label={t("modal.details")}>
      {card.color ? (
        <DetailChip className={chipClass} label={t("modal.filterBy", { value: card.color })} onClick={filterOn({ colors: [card.color] })}>
          <span className={`h-2 w-2 rounded-full ${colorDotClass(card.color)}`} aria-hidden="true" />
          {card.color}
        </DetailChip>
      ) : null}
      {card.cardType ? (
        <DetailChip className={chipClass} label={t("modal.filterBy", { value: card.cardType })} onClick={filterOn({ types: [card.cardType] })}>
          {card.cardType}
        </DetailChip>
      ) : null}
      {printing.rarity ? (
        <DetailChip
          className={`${chipClass} font-mono text-[10px] uppercase tracking-[0.04em] hover:brightness-125`}
          style={rarityChipStyle(printing.rarity)}
          label={t("modal.viewRarity", { rarity: printing.rarity })}
          onClick={onFilterRarity ? () => onFilterRarity(printing.rarity!) : undefined}
        >
          {printing.rarity}
        </DetailChip>
      ) : null}
      {stats.map((stat) => (
        <DetailChip
          key={stat.key}
          className={chipClass}
          label={t("modal.filterBy", { value: `${stat.label} ${stat.value}` })}
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
          label={t("modal.filterBy", { value: tag })}
          onClick={filterOn({ tags: [tag] })}
        >
          {tag}
        </DetailChip>
      ))}
      {card.isEddiable != null ? (
        <DetailChip
          label={t("modal.filterBy", { value: card.isEddiable ? t("modal.eddiesSellable") : t("modal.eddiesNotSellable") })}
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
          {card.isEddiable ? t("modal.eddiesSellable") : t("modal.eddiesNotSellable")}
        </DetailChip>
      ) : null}
    </div>
  );
}
