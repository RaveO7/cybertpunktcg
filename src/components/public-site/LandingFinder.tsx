"use client";

import { useEffect, useState, type ReactNode } from "react";

type Tab = "tournaments" | "shops";

type TabInfo = { id: string; label: string; count: number | null; panel: ReactNode };

/**
 * Onglets Tournois / Boutiques de l'accueil. Les deux annuaires sont rendus côté serveur (indexables) ;
 * l'onglet masqué est seulement caché. Les ancres #tournois et #boutiques ouvrent l'onglet voulu.
 */
export function LandingFinder({ tabs }: { tabs: Record<Tab, TabInfo> }) {
  const [current, setCurrent] = useState<Tab>("tournaments");

  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      const match = (Object.keys(tabs) as Tab[]).find((key) => tabs[key].id === hash);
      if (match) setCurrent(match);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const keys = Object.keys(tabs) as Tab[];

  return (
    <div className="flex flex-col">
      {/* Cible de l'ancre du second onglet (l'ancre du premier est la section elle-même). */}
      <span id={tabs.shops.id} className="block scroll-mt-2" aria-hidden="true" />
      <div role="tablist" aria-label={keys.map((key) => tabs[key].label).join(" / ")} className="mx-auto flex w-full max-w-[1100px] gap-1 px-3 sm:px-4">
        {keys.map((key) => {
          const selected = current === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`finder-tab-${key}`}
              aria-selected={selected}
              aria-controls={`finder-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCurrent(key)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                const next = keys[(keys.indexOf(key) + (event.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
                setCurrent(next);
                document.getElementById(`finder-tab-${next}`)?.focus();
              }}
              className={`relative flex h-11 items-center gap-2 border border-b-0 px-4 text-sm transition-colors ${
                selected ? "border-cyan bg-panel text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tabs[key].label}
              {tabs[key].count ? (
                <span className={`min-w-6 px-1.5 text-center font-mono text-xs ${selected ? "bg-yellow text-black" : "bg-panel-2 text-muted"}`}>
                  {tabs[key].count}
                </span>
              ) : null}
              {selected ? <span className="absolute inset-x-0 -bottom-px h-px bg-panel" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {keys.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={`finder-panel-${key}`}
          aria-labelledby={`finder-tab-${key}`}
          hidden={current !== key}
          className="border-t border-cyan/60 bg-panel/40"
        >
          {tabs[key].panel}
        </div>
      ))}
    </div>
  );
}
