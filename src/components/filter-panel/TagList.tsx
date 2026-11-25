"use client";

import { useState } from "react";
import { fieldClass } from "./field-class";

export function TagList({
  label,
  options,
  selected,
  onChange,
  filterPlaceholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  filterPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  if (options.length === 0) return null;
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? options.filter((option) => option.toLowerCase().includes(normalized))
    : options;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={`${label} — ${filterPlaceholder}`}
        placeholder={filterPlaceholder}
        className={`${fieldClass} mb-2`}
      />
      <div className="max-h-40 space-y-1 overflow-y-auto border border-line bg-panel p-2">
        {visible.map((option) => {
          const on = selected.includes(option);
          return (
            <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? selected.filter((value) => value !== option) : [...selected, option])}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
