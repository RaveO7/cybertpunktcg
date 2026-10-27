"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale, type Locale } from "@/i18n/config";
import { useNumberFormat } from "@/i18n/number-format";
import {
  conditionDot,
  conditionTone,
  fieldClass,
  fieldLabelClass,
  iconBtnClass,
  toAmount,
  todayInputValue,
} from "@/components/card-modal/shared";
import { conditionOptionLabel } from "@/lib/condition-label";
import { CURRENCIES } from "@/lib/parse";
import type { CollectionItemDTO, ConditionDTO } from "@/lib/types";

export function LineReadonly({
  item,
  conditions,
}: {
  item: CollectionItemDTO;
  conditions: ConditionDTO[];
}) {
  const t = useTranslations();
  const conditionName = conditions.find((entry) => entry.code === item.conditionCode)?.name;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className={`px-1.5 py-0.5 font-mono text-xs ${conditionTone(item.conditionCode)}`}>{item.conditionCode}</span>
      {conditionName ? <span>{conditionName}</span> : null}
      <span className="ml-auto font-mono text-muted">
        <span className="sr-only">{t("modal.quantity")} </span>×{item.quantity}
      </span>
    </div>
  );
}

export function LineEditor({
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
  const fmt = useNumberFormat();
  const t = useTranslations();
  const locale = useLocale() as Locale;
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
  const [date, setDate] = useState(item.purchasedAt ?? "");
  const [editing, setEditing] = useState(false);

  const conditionName = conditions.find((entry) => entry.code === item.conditionCode)?.name;
  const labelClass = `${fieldLabelClass} mb-1 md:sr-only`;
  const unit = toAmount(item.purchasePrice);
  const unitLabel = unit == null ? null : fmt.money(unit, item.purchaseCurrency || "EUR");
  // Le prix saisi est unitaire : le total de la ligne vaut quantité × prix.
  const totalAmount = unit == null || quantity < 2 ? null : fmt.money(unit * quantity, item.purchaseCurrency || "EUR");
  const totalLabel = totalAmount ? t("modal.priceTotal", { total: totalAmount }) : null;
  const dateLabel = item.purchasedAt
    ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.purchasedAt))
    : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 md:hidden">
        <span className={`px-1.5 py-0.5 font-mono text-xs ${conditionTone(item.conditionCode)}`}>{item.conditionCode}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm">
            ×{quantity}
            {unitLabel ? ` · ${t("modal.perUnit", { price: unitLabel })}` : ""}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </span>
          {totalLabel ? <span className="font-mono text-xs text-muted">{totalLabel}</span> : null}
          {item.notes ? <span className="truncate text-xs text-muted">{item.notes}</span> : null}
        </div>
        <button
          type="button"
          className={`grid h-11 w-11 shrink-0 place-items-center border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 ${
            editing ? "border-cyan/60 text-cyan" : "border-line text-muted"
          }`}
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
          aria-label={editing ? t("modal.doneEditing") : t("modal.editLine", { code: item.conditionCode })}
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
      className={`${editing ? "grid" : "hidden"} grid-cols-2 gap-x-3 gap-y-2.5 md:grid md:grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_9rem_minmax(0,1fr)_2.75rem] md:items-center`}
    >
      <label className="block">
        <span className={labelClass}>{t("modal.condition")}</span>
        <span className="relative flex h-10 items-center">
          <span className={`pointer-events-none absolute left-2 top-1/2 z-10 h-2 w-2 -translate-y-1/2 ${conditionDot(item.conditionCode)}`} aria-hidden="true" />
          <select
            className="h-full w-full min-w-0 border border-line bg-background pl-6 pr-1 font-mono text-sm outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/70"
            value={item.conditionCode}
            onChange={(event) => void onPatch(item.id, { conditionCode: event.target.value })}
            title={conditionName ? `${item.conditionCode} — ${conditionName}` : t("modal.condition")}
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
          {t("modal.quantity")}
        </span>
        <div className="inline-flex h-10 w-full items-stretch border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
          <button
            type="button"
            className={iconBtnClass}
            aria-label={t("modal.decreaseQty")}
            onClick={() => setQuantity(quantity - 1)}
          >
            −
          </button>
          <input
            aria-label={t("modal.quantity")}
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
            aria-label={t("modal.increaseQty")}
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="col-span-2 md:col-span-1">
        <span className={labelClass} aria-hidden="true">
          {t("modal.unitPurchasePrice")}
        </span>
        <div className="flex h-10 border border-line bg-background focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan/70">
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
            placeholder="—"
            aria-label={t("modal.unitPurchasePrice")}
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
            aria-label={t("modal.currency")}
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
        <span className={labelClass}>{t("modal.purchaseDate")}</span>
        <input
          type="date"
          className={`${fieldClass} font-mono`}
          max={todayInputValue()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          onBlur={() => {
            if ((item.purchasedAt ?? "") !== date) void onPatch(item.id, { purchasedAt: date || null });
          }}
        />
      </label>

      <label className="col-span-2 block md:col-span-1">
        <span className={labelClass}>{t("modal.notes")}</span>
        <input
          className={fieldClass}
          placeholder={t("modal.notesPlaceholder")}
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
        aria-label={t("modal.remove")}
        title={t("modal.remove")}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
        </svg>
        <span className="md:hidden">{t("modal.remove")}</span>
      </button>
    </div>
    </div>
  );
}
