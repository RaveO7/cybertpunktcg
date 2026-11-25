"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { chooseLocale } from "@/i18n/choose-locale";
import { LANGUAGES } from "@/i18n/config";

/**
 * Choix de la langue parmi toutes celles du site. Sur une page publique, mène à la même page dans la
 * langue choisie ; ailleurs, change la langue de l'application. Liste déroulante maison (la liste native
 * ne se laisse pas habiller) : flèches, Début/Fin, Entrée, Échap et première lettre au clavier.
 */
export function LanguageSelect() {
  const t = useTranslations();
  const current = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const currentIndex = Math.max(0, LANGUAGES.findIndex((entry) => entry.code === current));

  const openList = (index = currentIndex) => {
    setActive(index);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    const next = LANGUAGES[index].code;
    close(true);
    if (next !== current) chooseLocale(next);
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
    const last = LANGUAGES.length - 1;
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
        const order = [...LANGUAGES.keys()].map((offset) => (active + 1 + offset) % LANGUAGES.length);
        const match = order.find((index) => LANGUAGES[index].label.toLowerCase().startsWith(letter));
        if (match === undefined) return;
        setActive(match);
      }
    }
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
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
        aria-label={`${t("nav.language")} : ${LANGUAGES[currentIndex].label}`}
        className="cp-select"
      >
        <svg viewBox="0 0 16 16" className="size-3.5 text-cyan" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M1.75 8h12.5M8 1.75c-3.2 3.4-3.2 9.1 0 12.5M8 1.75c3.2 3.4 3.2 9.1 0 12.5" />
        </svg>
        <span aria-hidden="true">{current}</span>
        <svg
          viewBox="0 0 10 6"
          className={`h-1.5 w-2.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
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
          aria-label={t("nav.language")}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          className="absolute right-0 top-full z-40 mt-1.5 max-h-80 min-w-44 overflow-y-auto border border-cyan/60 bg-[var(--hud-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)] outline-none"
        >
          {LANGUAGES.map((entry, index) => {
            const selected = entry.code === current;
            return (
              <li
                key={entry.code}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                lang={entry.code}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`relative flex cursor-pointer items-center gap-3 py-2 pl-4 pr-3 text-sm ${
                  index === active ? "bg-panel-2 text-foreground" : selected ? "text-yellow" : "text-muted"
                }`}
              >
                {index === active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-cyan" aria-hidden="true" /> : null}
                <span className={`w-6 font-mono text-xs uppercase ${selected ? "text-yellow" : "text-cyan"}`}>{entry.code}</span>
                <span className={`flex-1 ${selected ? "text-yellow" : ""}`}>{entry.label}</span>
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
  );
}
