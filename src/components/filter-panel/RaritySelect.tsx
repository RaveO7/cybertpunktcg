"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { fieldClass } from "./field-class";
import { RarityIcon } from "./RarityIcon";

/**
 * Filtre de rareté : liste déroulante maison pour afficher la pastille de chaque rareté (la liste native
 * n'accepte que du texte). Flèches, Début/Fin, Entrée, Échap et première lettre au clavier.
 */
export function RaritySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options[currentIndex];

  const openList = (index = currentIndex) => {
    setActive(index);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    close(true);
    if (options[index].value !== value) onChange(options[index].value);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        setActive((index) => Math.min(last, index + 1));
        break;
      case "ArrowUp":
        setActive((index) => Math.max(0, index - 1));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(last);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        setOpen(false);
        return;
      default: {
        if (event.key.length !== 1) return;
        const letter = event.key.toLowerCase();
        const order = [...options.keys()].map((offset) => (active + 1 + offset) % options.length);
        const match = order.find((index) => options[index].label.toLowerCase().startsWith(letter));
        if (match === undefined) return;
        setActive(match);
      }
    }
    event.preventDefault();
  };

  return (
    <div className="text-sm">
      <span id={labelId} className="mb-1 block text-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              openList();
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${listId}-value`}
          className={`${fieldClass} flex items-center gap-2 text-left`}
        >
          <RarityIcon rarity={current?.value ?? ""} />
          <span id={`${listId}-value`} className="flex-1 truncate">
            {current?.label}
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
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKeyDown}
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none"
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <li
                  key={option.value || "all"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={`relative flex cursor-pointer items-center gap-2 px-3 py-2 ${
                    index === active ? "bg-panel-2 text-foreground" : selected ? "text-yellow" : "text-muted"
                  }`}
                >
                  {index === active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-cyan" aria-hidden="true" /> : null}
                  <RarityIcon rarity={option.value} />
                  <span className={`flex-1 ${selected ? "text-yellow" : ""}`}>{option.label}</span>
                  {selected ? (
                    <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-yellow" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M1 5l3.5 3.5L11 1" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
