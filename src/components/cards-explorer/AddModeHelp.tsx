"use client";

import { useTranslations } from "next-intl";
import { conditionOptionLabel } from "@/lib/condition-label";
import type { ConditionDTO } from "@/lib/types";

/** Encart du mode ajout : aide, début de plage, état appliqué au lot et « tout sélectionner ». */
export function AddModeHelp({
  conditions,
  addCondition,
  rangeStartNumber,
  canSelectAll,
  onConditionChange,
  onSelectAll,
  onClearSelection,
}: {
  conditions: ConditionDTO[];
  addCondition: string;
  /** Numéro de la carte qui ouvre une plage ; null sans plage en cours. */
  rangeStartNumber: string | null;
  canSelectAll: boolean;
  onConditionChange: (code: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  const t = useTranslations();
  return (
    <div data-add-help="" className="mb-3 flex flex-col gap-3 border border-yellow/50 bg-panel p-3">
      <p className="text-sm text-muted pointer-coarse:hidden">{t("cards.addModeHelp")}</p>
      <p className="hidden text-sm text-muted pointer-coarse:block">{t("cards.addModeHelpTouch")}</p>
      {rangeStartNumber !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-cyan">{t("cards.rangeStart", { number: rangeStartNumber })}</p>
          <button type="button" className="h-9 border border-line px-3 text-sm" onClick={onClearSelection}>
            {t("cards.cancelSelection")}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t("cards.addCondition")}
          className="h-10 min-w-0 flex-1 border border-line bg-panel-2 px-3 font-mono text-sm sm:flex-none"
          value={addCondition}
          onChange={(event) => onConditionChange(event.target.value)}
        >
          {conditions.map((condition) => (
            <option key={condition.code} value={condition.code} className="font-mono">
              {conditionOptionLabel(condition, conditions)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="h-10 border border-line px-3 text-sm text-cyan disabled:opacity-40"
          onClick={onSelectAll}
          disabled={!canSelectAll}
        >
          {t("cards.selectAll")}
        </button>
      </div>
    </div>
  );
}
