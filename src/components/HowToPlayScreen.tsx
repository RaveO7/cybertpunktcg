"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HowToPlayRules } from "@/components/HowToPlayRules";
import { HowToPlayTutorial } from "@/components/HowToPlayTutorial";
import { useI18n } from "@/components/LocaleProvider";
import { tutorialCopy } from "@/lib/rules/tutorial";

type Mode = "learn" | "rules";

export function HowToPlayScreen() {
  const { locale } = useI18n();
  const contentLocale = locale === "fr" ? "fr" : "en";
  const t = tutorialCopy(contentLocale);
  const [mode, setMode] = useState<Mode>("rules");
  const [progress, setProgress] = useState<{ step: number; total: number } | null>(null);
  const rulesScrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const backToTopLabel = contentLocale === "fr" ? "Remonter en haut" : "Back to top";
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const leaveCopy =
    contentLocale === "fr"
      ? {
          title: "Quitter le parcours débutant ?",
          body: "Ta progression dans le parcours sera perdue et il faudra le recommencer depuis le début.",
          stay: "Continuer le parcours",
          leave: "Quitter",
        }
      : {
          title: "Leave the beginner path?",
          body: "Your progress in the path will be lost and you will have to start over from the beginning.",
          stay: "Keep going",
          leave: "Leave",
        };

  const onProgress = useCallback((step: number, total: number) => {
    setProgress({ step, total });
  }, []);

  const pct = progress ? Math.round((progress.step / progress.total) * 100) : 0;

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setLeaveConfirm(false);
    if (next === "learn") setShowTop(false);
    else setProgress(null);
  }, []);

  // Quitter le parcours le réinitialise : on demande confirmation s'il est commencé et pas terminé.
  const inProgress = mode === "learn" && progress !== null && progress.step > 1 && progress.step < progress.total;
  function leaveLearn() {
    if (inProgress) setLeaveConfirm(true);
    else switchMode("rules");
  }

  // Téléphone : balayer vers la gauche ouvre le parcours débutant, vers la droite revient aux règles.
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const target = event.target;
    if (event.touches.length !== 1 || (target instanceof Element && isInHorizontalScroller(target))) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && mode === "rules") switchMode("learn");
    else if (dx > 0 && mode === "learn") leaveLearn();
  }

  const tabs = (
    <div className="mb-2 flex items-stretch border border-line">
      <button
        type="button"
        onClick={() => (mode === "learn" ? leaveLearn() : undefined)}
        className={`flex-1 px-3 py-2 text-sm sm:flex-none ${
          mode === "rules" ? "bg-yellow text-black" : "text-muted hover:text-foreground"
        }`}
        aria-current={mode === "rules" ? "page" : undefined}
      >
        {t.rulesTab}
      </button>
      <button
        type="button"
        onClick={() => switchMode("learn")}
        className={`flex-1 px-3 py-2 text-sm sm:flex-none ${
          mode === "learn" ? "bg-yellow text-black" : "text-muted hover:text-foreground"
        }`}
        aria-current={mode === "learn" ? "page" : undefined}
      >
        {t.learnTab}
      </button>

      {mode === "learn" && progress ? (
        <div className="ml-auto flex items-center gap-2.5 border-l border-line px-3">
          <span className="font-mono text-xs whitespace-nowrap text-muted">
            {progress.step}/{progress.total}
          </span>
          <div
            className="h-1.5 w-20 overflow-hidden border border-line bg-panel sm:w-28"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-yellow transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* On phones the rules tabs scroll away with the content instead of staying pinned. */}
      <div
        className={`mx-auto w-full max-w-[1600px] shrink-0 px-3 pt-2 sm:px-4 ${mode === "rules" ? "hidden lg:block" : ""}`}
      >
        {tabs}
      </div>

      {mode === "rules" ? (
        <div
          ref={rulesScrollRef}
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 400)}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[1600px] px-3 pb-4 sm:px-4">
            <div className="pt-2 lg:hidden">{tabs}</div>
            <HowToPlayRules />
          </div>
          {showTop ? (
            <button
              type="button"
              onClick={() => rulesScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed right-4 bottom-[calc(var(--app-bottom-nav)+1rem)] z-30 flex h-11 w-11 items-center justify-center border border-yellow bg-panel text-lg text-yellow shadow-lg hover:bg-yellow hover:text-black"
              aria-label={backToTopLabel}
              title={backToTopLabel}
            >
              ↑
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 pb-2 sm:px-4">
          <HowToPlayTutorial
            locale={contentLocale}
            onOpenRules={leaveLearn}
            onProgress={onProgress}
          />
        </div>
      )}

      {/* Portail au-dessus du parcours, qui passe lui-même en plein écran (portail z-[60]) sur téléphone. */}
      {leaveConfirm
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-tutorial-title"
              onClick={() => setLeaveConfirm(false)}
            >
              <div className="w-full max-w-md border border-yellow bg-panel p-5" onClick={(e) => e.stopPropagation()}>
                <h2 id="leave-tutorial-title" className="text-lg text-yellow">
                  {leaveCopy.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">{leaveCopy.body}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="h-10 border border-line px-4 text-sm"
                    onClick={() => setLeaveConfirm(false)}
                  >
                    {leaveCopy.stay}
                  </button>
                  <button
                    type="button"
                    className="h-10 bg-yellow px-4 text-sm font-semibold text-black"
                    onClick={() => switchMode("rules")}
                  >
                    {leaveCopy.leave}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// Un balayage dans une zone défilant horizontalement (schéma du tapis, tableaux…) ne doit pas changer d'onglet.
function isInHorizontalScroller(target: Element): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.hasAttribute("data-no-swipe")) return true;
    if (el.scrollWidth > el.clientWidth) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}
