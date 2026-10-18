"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CardImage } from "@/components/CardImage";
import { nameParts } from "@/components/CardTile";
import { usePreferences } from "@/components/PreferencesProvider";
import { conditionOptionLabel } from "@/lib/condition-label";
import { CURRENCIES } from "@/lib/parse";
import type { CardDTO, ConditionDTO, PrintingDTO } from "@/lib/types";

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  fr: "🇫🇷",
  de: "🇩🇪",
  es: "🇪🇸",
  it: "🇮🇹",
};

const LANGUAGE_ORDER = ["fr", "en", "de", "es", "it"];

/** Feuille d'ajout du mode ajout : quantité, état, langue et version de la carte touchée. */
export function QuickAddSheet({
  printing: initial,
  card,
  printings,
  conditions,
  defaultCondition,
  onSave,
  onClose,
}: {
  printing: PrintingDTO;
  card: CardDTO | undefined;
  /** Tous les tirages de la même carte (langues et versions), celui touché compris. */
  printings: PrintingDTO[];
  conditions: ConditionDTO[];
  defaultCondition: string;
  onSave: (input: {
    printingId: string;
    conditionCode: string;
    quantity: number;
    notes?: string;
    purchasePrice?: string;
    purchaseCurrency?: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [printingId, setPrintingId] = useState(initial.id);
  const [quantity, setQuantity] = useState("1");
  const [conditionCode, setConditionCode] = useState(defaultCondition);
  const { prefs } = usePreferences();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>(prefs.currency);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = printings.find((item) => item.id === printingId) ?? initial;
  const { name } = nameParts(card, current);
  const languageLabels: Record<string, string> = {
    en: t("common.english"),
    fr: t("common.french"),
    de: t("common.german"),
    es: t("common.spanish"),
    it: t("common.italian"),
  };
  const languages = useMemo(() => {
    const found = [...new Set(printings.map((item) => item.language))];
    const rank = (language: string) => {
      const index = LANGUAGE_ORDER.indexOf(language);
      return index === -1 ? LANGUAGE_ORDER.length : index;
    };
    return found.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [printings]);
  const versions = printings
    .filter((item) => item.language === current.language)
    .sort(
      (a, b) =>
        a.setName.localeCompare(b.setName) ||
        a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }),
    );

  function changeLanguage(language: string) {
    const candidates = printings.filter((item) => item.language === language);
    // Même numéro (même illustration) dans la nouvelle langue si possible.
    const match =
      candidates.find((item) => item.setCode === current.setCode && item.collectorNumber === current.collectorNumber) ??
      candidates.find((item) => item.collectorNumber === current.collectorNumber) ??
      candidates[0];
    if (match) setPrintingId(match.id);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const parsedQuantity = Number(quantity);
  const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 999;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validQuantity || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        printingId: current.id,
        conditionCode,
        quantity: parsedQuantity,
        notes: notes.trim() ? notes.trim() : undefined,
        purchasePrice: price.trim() ? price.trim() : undefined,
        purchaseCurrency: price.trim() ? currency : undefined,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("modal.addFailed"));
      setSaving(false);
    }
  }

  const fieldClass = "h-12 w-full min-w-0 border border-line bg-panel-2 px-3 text-base outline-none focus:border-cyan";
  const labelClass = "mb-1.5 block text-sm font-semibold";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onSubmit={(event) => void submit(event)}
        className="pb-safe scrollbar-hud max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain border-t border-yellow/60 bg-panel px-4 pt-2 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] sm:border sm:pb-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-center gap-3">
          {current.imagePath ? (
            <div className="aspect-card w-12 shrink-0 overflow-hidden bg-overlay">
              <CardImage src={current.imagePath} alt="" draggable={false} className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 id="quick-add-title" className="truncate text-xl font-bold text-white">
              {name}
            </h2>
            <p className="font-mono text-sm text-muted">
              {current.rarity ? `${current.rarity} · ` : ""}#{current.collectorNumber}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="min-w-0">
            <span className={labelClass}>{t("modal.unitPurchasePrice")}</span>
            <span className="flex h-12 border border-line bg-panel-2 focus-within:border-cyan">
              <input
                inputMode="decimal"
                placeholder="—"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 font-mono text-base outline-none"
              />
              <select
                aria-label={t("modal.currency")}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="shrink-0 border-l border-line bg-panel px-2 font-mono text-sm outline-none"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="min-w-0">
            <span className={labelClass}>{t("modal.notes")}</span>
            <input
              placeholder={t("modal.notesPlaceholder")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="min-w-0">
            <span className={labelClass}>{t("filters.language")}</span>
            <select
              value={current.language}
              onChange={(event) => changeLanguage(event.target.value)}
              disabled={languages.length < 2}
              className={`${fieldClass} disabled:opacity-60`}
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {`${LANGUAGE_FLAGS[language] ?? ""} ${languageLabels[language] ?? language}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className={labelClass}>{t("cards.quickAddVersion")}</span>
            <select
              value={current.id}
              onChange={(event) => setPrintingId(event.target.value)}
              disabled={versions.length < 2}
              className={`${fieldClass} disabled:opacity-60`}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {[version.setName, `#${version.collectorNumber}`, version.officialFinish].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className={labelClass}>{t("modal.quantity")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              onFocus={(event) => event.target.select()}
              className={`${fieldClass} font-mono`}
            />
          </label>
          <label className="min-w-0">
            <span className={labelClass}>{t("modal.condition")}</span>
            <select value={conditionCode} onChange={(event) => setConditionCode(event.target.value)} className={fieldClass}>
              {conditions.map((condition) => (
                <option key={condition.code} value={condition.code}>
                  {conditionOptionLabel(condition, conditions)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 pb-3">
          <button type="button" className="h-12 border border-line text-base" onClick={onClose}>
            {t("cards.quickAddCancel")}
          </button>
          <button
            type="submit"
            disabled={!validQuantity || saving}
            className="h-12 bg-yellow text-base font-semibold text-black disabled:opacity-50"
          >
            {saving ? t("modal.adding") : t("modal.add")}
          </button>
        </div>
      </form>
    </div>
  );
}
