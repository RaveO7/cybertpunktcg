import type { CSSProperties } from "react";
import type { DemoTableCopy } from "@/lib/rules/demo-match";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";
import type { TryAction } from "./types";

export function ActionButtons({
  copy,
  expect,
  done,
  compact,
  tryAction,
  restart,
  onOpenRules,
}: {
  copy: DemoTableCopy;
  expect: ExpectAction;
  done: boolean;
  compact: boolean;
  tryAction: TryAction;
  restart: () => void;
  onOpenRules: () => void;
}) {
  const btn = compact ? "flex-1 px-4 py-2.5 text-sm" : "px-4 py-2 text-sm";
  return (
    <>
      {expect.kind === "begin" ? (
        <button
          type="button"
          data-coach-id="coach-begin"
          onClick={() => tryAction({ type: "begin" })}
          className={`${btn} dm-cta border border-yellow bg-yellow font-medium text-black shadow-lg`}
        >
          {copy.begin}
        </button>
      ) : null}
      {expect.kind === "continue" ? (
        <button
          type="button"
          data-coach-id="coach-continue"
          onClick={() => tryAction({ type: "continue" })}
          className={`${btn} dm-cta border border-danger bg-danger/20 text-danger shadow-lg backdrop-blur-sm`}
          style={{ "--dm-cta-glow": "rgba(255, 93, 108, 0.55)", "--dm-cta-ring": "rgba(255, 93, 108, 0.18)" } as CSSProperties}
        >
          {copy.next}
        </button>
      ) : null}
      {expect.kind === "end-turn" ? (
        <button
          type="button"
          data-coach-id="coach-end-turn"
          onClick={() => tryAction({ type: "end-turn" })}
          className={`${btn} dm-cta border border-yellow bg-yellow font-medium text-black shadow-lg`}
        >
          {copy.endTurn}
        </button>
      ) : null}
      {done ? (
        <div data-coach-id="coach-done" className={`flex gap-2 ${compact ? "w-full" : "flex-wrap"}`}>
          <button
            type="button"
            onClick={restart}
            className={`${btn} dm-cta border border-yellow bg-yellow text-black shadow-lg`}
          >
            {copy.restart}
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            className={`${btn} border border-cyan bg-cyan/15 text-cyan shadow-lg backdrop-blur-sm`}
          >
            {copy.openRules}
          </button>
        </div>
      ) : null}
    </>
  );
}
