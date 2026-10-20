"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePreferences } from "@/components/PreferencesProvider";
import { conditionDot, fieldClass, iconBtnClass } from "@/components/card-modal/shared";
import { conditionOptionLabel } from "@/lib/condition-label";
import { CURRENCIES } from "@/lib/parse";
import type { CollectionItemDTO, ConditionDTO } from "@/lib/types";

export type AddCopyInput = {
  conditionCode: string;
  quantity: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

/** État du formulaire d'ajout, partagé entre la version bureau et la barre du bas sur téléphone. */
export function useAddCopyForm(printingId: string, onSave: ((input: AddCopyInput) => Promise<void>) | undefined) {
  const t = useTranslations();
  const { prefs } = usePreferences();

  const [conditionCode, setConditionCode] = useState(prefs.condition);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>(prefs.currency);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Autre carte ou préférences modifiées : le formulaire d'ajout repart des préférences.
  const formDefaultsKey = `${prefs.condition}|${prefs.currency}|${printingId}`;
  const [syncedFormDefaults, setSyncedFormDefaults] = useState(formDefaultsKey);
  if (formDefaultsKey !== syncedFormDefaults) {
    setSyncedFormDefaults(formDefaultsKey);
    setConditionCode(prefs.condition);
    setCurrency(prefs.currency);
  }

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
      setMessage(error instanceof Error ? error.message : t("modal.addFailed"));
    } finally {
      setPending(false);
    }
  }

  return {
    conditionCode,
    setConditionCode,
    quantity,
    setQuantity,
    notes,
    setNotes,
    price,
    setPrice,
    currency,
    setCurrency,
    message,
    pending,
    showMoreFields,
    setShowMoreFields,
    add,
  };
}

export type AddCopyFormState = ReturnType<typeof useAddCopyForm>;

/** Formulaire d'ajout sur ordinateur, sous les exemplaires de la collection. */
export function DesktopAddForm({
  form,
  items,
  conditions,
  titleId,
  formErrorId,
}: {
  form: AddCopyFormState;
  items: CollectionItemDTO[];
  conditions: ConditionDTO[];
  titleId: string;
  formErrorId: string;
}) {
  const t = useTranslations();
  const { conditionCode, setConditionCode, quantity, setQuantity, notes, setNotes, price, setPrice, currency, setCurrency, message, pending, add } =
    form;
  return (
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
        {t("modal.addCopy")}
      </h3>
      {items.length === 0 ? (
        <div
          className="grid grid-cols-[9rem_7.5rem_minmax(7rem,10rem)_minmax(0,1fr)_2.75rem] gap-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
          aria-hidden="true"
        >
          <span>{t("modal.condition")}</span>
          <span>{t("modal.quantity")}</span>
          <span>{t("modal.unitPurchasePrice")}</span>
          <span>{t("modal.notes")}</span>
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
            aria-label={t("modal.condition")}
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
            aria-label={t("modal.decreaseQty")}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          >
            −
          </button>
          <input
            className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm outline-none"
            inputMode="numeric"
            aria-label={t("modal.quantity")}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          <button
            type="button"
            className={iconBtnClass}
            aria-label={t("modal.increaseQty")}
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
            aria-label={t("modal.unitPurchasePrice")}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <select
            className="shrink-0 border-l border-line bg-panel px-1.5 font-mono text-xs text-foreground/80 outline-none"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            aria-label={t("modal.currency")}
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
          placeholder={t("modal.notesPlaceholder")}
          aria-label={t("modal.notes")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center bg-yellow text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/80 disabled:opacity-60"
          aria-label={pending ? t("modal.adding") : t("modal.add")}
          title={t("modal.add")}
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
  );
}

/** Téléphone : formulaire d'ajout collé en bas de la fiche. */
export function MobileAddForm({
  form,
  conditions,
  formErrorId,
}: {
  form: AddCopyFormState;
  conditions: ConditionDTO[];
  formErrorId: string;
}) {
  const t = useTranslations();
  const {
    conditionCode,
    setConditionCode,
    quantity,
    setQuantity,
    notes,
    setNotes,
    price,
    setPrice,
    currency,
    setCurrency,
    message,
    pending,
    showMoreFields,
    setShowMoreFields,
    add,
  } = form;
  return (
    <form
      className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-line bg-panel-2 px-4 pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom)-var(--app-bottom-nav)))] pt-3 md:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
      aria-label={t("modal.addCopy")}
      aria-describedby={message ? `${formErrorId}-m` : undefined}
    >
      <div
        role="group"
        aria-label={t("modal.condition")}
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
              aria-label={t("modal.unitPurchasePrice")}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <select
              className="shrink-0 border-l border-line bg-panel px-2 font-mono text-xs text-foreground/80 outline-none"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              aria-label={t("modal.currency")}
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
            placeholder={t("modal.notesPlaceholder")}
            aria-label={t("modal.notes")}
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
            aria-label={t("modal.decreaseQty")}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          >
            −
          </button>
          <input
            className="w-8 min-w-0 bg-transparent text-center font-mono text-base outline-none"
            inputMode="numeric"
            aria-label={t("modal.quantity")}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          <button
            type="button"
            className={`${iconBtnClass} w-11 text-lg`}
            aria-label={t("modal.increaseQty")}
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
          {pending ? t("modal.adding") : t("modal.addToCollection")}
        </button>
      </div>
      <button
        type="button"
        className="h-9 text-[13px] text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70"
        onClick={() => setShowMoreFields((value) => !value)}
        aria-expanded={showMoreFields}
      >
        {showMoreFields ? "− " : "+ "}
        {t("modal.moreFields")}
      </button>
      {message ? (
        <p id={`${formErrorId}-m`} role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </form>
  );
}
