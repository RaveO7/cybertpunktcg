"use client";

import { DemoMatch } from "@/components/DemoMatch";

export function HowToPlayTutorial({
  onOpenRules,
  onProgress,
}: {
  onOpenRules: () => void;
  onProgress?: (step: number, total: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <DemoMatch onOpenRules={onOpenRules} onProgress={onProgress} />
    </div>
  );
}
