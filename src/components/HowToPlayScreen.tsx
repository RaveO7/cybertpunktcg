"use client";

import { useCallback, useState } from "react";
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

  const onProgress = useCallback((step: number, total: number) => {
    setProgress({ step, total });
  }, []);

  const pct = progress ? Math.round((progress.step / progress.total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-[1600px] shrink-0 px-3 pt-2 sm:px-4">
        <div className="mb-2 flex items-stretch border border-line">
          <button
            type="button"
            onClick={() => setMode("rules")}
            className={`flex-1 px-3 py-2 text-sm sm:flex-none ${
              mode === "rules" ? "bg-yellow text-black" : "text-muted hover:text-foreground"
            }`}
            aria-current={mode === "rules" ? "page" : undefined}
          >
            {t.rulesTab}
          </button>
          <button
            type="button"
            onClick={() => setMode("learn")}
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
      </div>

      {mode === "rules" ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-3 pb-4 sm:px-4">
            <HowToPlayRules />
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 pb-2 sm:px-4">
          <HowToPlayTutorial
            locale={contentLocale}
            onOpenRules={() => setMode("rules")}
            onProgress={onProgress}
          />
        </div>
      )}
    </div>
  );
}
