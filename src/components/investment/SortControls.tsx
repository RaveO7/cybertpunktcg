"use client";

import { useId } from "react";
import type { MessageKey, Translator } from "@/i18n/translator";
import { initialSortDir, type SortDir, type SortState } from "@/components/investment/sorting";

// Colonnes de droite : l’infobulle s’aligne à droite pour ne pas déborder de l’écran.
const RIGHT_HINT_COLUMNS = new Set<string>(["marketVar", "invested", "purchasePnL"]);

export function SortableTh<K extends string>({
  label,
  columnKey,
  sort,
  onSort,
  t,
}: {
  label: string;
  columnKey: K;
  sort: SortState<K> | null;
  onSort: (next: SortState<K>) => void;
  t: Translator;
}) {
  const active = sort != null && sort.key === columnKey;
  const nextDir: SortDir = active ? (sort.dir === "asc" ? "desc" : "asc") : initialSortDir(columnKey);
  const directionLabel = nextDir === "asc" ? t("investment.sortAsc") : t("investment.sortDesc");
  const hintKey = `investment.colHints.${columnKey}` as MessageKey;
  const hint = t.has(hintKey) ? t(hintKey) : undefined;
  const hintId = useId();
  const alignRight = RIGHT_HINT_COLUMNS.has(columnKey);

  return (
    <th
      className={`group relative border-b-2 px-1 py-0 font-medium ${
        active ? "border-cyan bg-cyan/10 text-cyan" : "border-transparent"
      }`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 px-2 py-2 text-left transition-colors hover:text-cyan ${
          active ? "text-cyan" : "text-muted"
        }`}
        onClick={() => onSort({ key: columnKey, dir: nextDir })}
        aria-label={t("investment.sortBy", { column: label, direction: directionLabel })}
        aria-describedby={hint ? hintId : undefined}
      >
        <span className="min-w-0 flex-1">{label}</span>
        <SortArrow active={active} dir={active ? sort.dir : null} />
      </button>
      {hint ? (
        <span
          id={hintId}
          role="tooltip"
          className={`pointer-events-none absolute top-full z-20 mt-1.5 hidden w-64 border border-cyan/50 bg-black/95 px-3 py-2 text-xs leading-relaxed font-normal normal-case tracking-normal text-foreground opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-[opacity,display] transition-discrete delay-150 duration-150 group-hover:block group-hover:opacity-100 group-hover:starting:opacity-0 group-has-[:focus-visible]:block group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:starting:opacity-0 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {hint}
        </span>
      ) : null}
    </th>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir | null }) {
  if (!active || !dir) {
    return (
      <span className="inline-flex w-3 shrink-0 flex-col items-center gap-0.5 opacity-35" aria-hidden>
        <span className="h-0 w-0 border-x-[3px] border-b-[4px] border-x-transparent border-b-current" />
        <span className="h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-current" />
      </span>
    );
  }
  return (
    <span className="inline-flex w-3 shrink-0 flex-col items-center" aria-hidden>
      {dir === "asc" ? (
        <span className="h-0 w-0 border-x-[4px] border-b-[5px] border-x-transparent border-b-current" />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-current" />
      )}
    </span>
  );
}

/** Tri des listes mobiles : les en-têtes de colonnes n'existent pas sous md. */
export function MobileSort<K extends string>({
  options,
  sort,
  onSort,
  t,
}: {
  options: { key: K; label: string }[];
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  t: Translator;
}) {
  const nextDir: SortDir = sort.dir === "asc" ? "desc" : "asc";
  return (
    <div className="mb-2 flex items-center gap-2 text-sm md:hidden">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-muted">{t("investment.sortLabel")}</span>
        <select
          className="h-10 w-full min-w-0 border border-line bg-background px-3 outline-none focus:border-cyan"
          value={sort.key}
          onChange={(event) => {
            const key = event.target.value as K;
            onSort({ key, dir: initialSortDir(key) });
          }}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="grid h-10 w-10 shrink-0 place-items-center border border-line text-cyan hover:border-cyan"
        aria-label={nextDir === "asc" ? t("investment.sortAsc") : t("investment.sortDesc")}
        onClick={() => onSort({ key: sort.key, dir: nextDir })}
      >
        <SortArrow active dir={sort.dir} />
      </button>
    </div>
  );
}

/** Aide des colonnes sur téléphone : pas d'en-têtes à survoler, les définitions se déplient. */
export function MobileColumnHints<K extends string>({ columns, t }: { columns: { key: K; label: string }[]; t: Translator }) {
  const hints = columns.flatMap((column) => {
    const hintKey = `investment.colHints.${column.key}` as MessageKey;
    return t.has(hintKey) ? [{ ...column, hint: t(hintKey) }] : [];
  });
  if (hints.length === 0) return null;
  return (
    <details className="group mb-2 border border-line bg-panel text-xs md:hidden">
      <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm text-muted [&::-webkit-details-marker]:hidden">
        {t("investment.colHintsTitle")}
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <dl className="flex flex-col gap-2 border-t border-line px-3 py-3 leading-relaxed">
        {hints.map((column) => (
          <div key={column.key}>
            <dt className="text-foreground">{column.label}</dt>
            <dd className="text-muted">{column.hint}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
