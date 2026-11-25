"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fieldClass } from "./field-class";

/**
 * Choix des extensions : menu à cases à cocher, plusieurs extensions à la fois. Aucune case cochée
 * (ou « Toutes les extensions ») revient à tout afficher. Échap ou un clic à l'extérieur referme.
 */
export function SetMultiSelect({
  label,
  allLabel,
  countLabel,
  selected,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  countLabel: (count: number) => string;
  selected: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  const panelId = useId();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const chosen = options.filter((option) => selected.includes(option.value));
  const summary = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : countLabel(chosen.length);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = (value: string) => {
    const on = selected.includes(value);
    // Garde l'ordre des options pour une URL stable.
    const next = options.map((option) => option.value).filter((code) => (code === value ? !on : selected.includes(code)));
    onChange(next);
  };

  return (
    <div
      className="text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <span id={labelId} className="mb-1 block text-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-labelledby={`${labelId} ${panelId}-value`}
          className={`${fieldClass} flex items-center gap-2 text-left`}
        >
          <span id={`${panelId}-value`} className="flex-1 truncate">
            {summary}
          </span>
          <svg
            viewBox="0 0 10 6"
            className={`h-1.5 w-2.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
        {open ? (
          <fieldset
            id={panelId}
            aria-labelledby={labelId}
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          >
            <label className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 hover:bg-panel-2">
              <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
              <span className={selected.length === 0 ? "text-yellow" : ""}>{allLabel}</span>
            </label>
            {options.map((option) => {
              const on = selected.includes(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-panel-2">
                  <input type="checkbox" checked={on} onChange={() => toggle(option.value)} />
                  <span className={on ? "text-yellow" : ""}>{option.label}</span>
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
