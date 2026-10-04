"use client";

import { DemoMatch } from "@/components/DemoMatch";
import type { TutorialLocale } from "@/lib/rules/tutorial";

export function HowToPlayTutorial({
  locale,
  onOpenRules,
  onProgress,
}: {
  locale: TutorialLocale;
  onOpenRules: () => void;
  onProgress?: (step: number, total: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <DemoMatch locale={locale} onOpenRules={onOpenRules} onProgress={onProgress} />
    </div>
  );
}
