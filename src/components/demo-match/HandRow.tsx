import type { CSSProperties } from "react";
import { GameCard } from "@/components/GameCard";
import { cardOf, type DemoTableCopy } from "@/lib/rules/demo-match";
import type { CardRef, MatchState } from "@/lib/rules/demo-match-state";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";
import type { TryAction } from "./types";

function pulseHand(expect: ExpectAction, card: CardRef) {
  return expect.kind === "hand" && expect.card === card;
}

export function HandRow({
  copy,
  state,
  expect,
  tryAction,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  expect: ExpectAction;
  tryAction: TryAction;
}) {
  const handFan = state.hand.length;
  return (
    <div
      className="flex min-h-0 flex-col justify-end overflow-hidden border-t border-line/50 pt-[var(--dm-gap)]"
      data-coach-id="coach-hand-zone"
    >
      <p className="demo-hud-label mb-1 shrink-0">{copy.yourHand}</p>
      <div className="demo-match-hand min-h-0">
        {state.hand.map((ref, index) => {
          const offset = index - (handFan - 1) / 2;
          return (
            <div
              key={ref}
              style={{
                // La carte attendue passe devant ses voisines pour rester touchable.
                zIndex: pulseHand(expect, ref) ? 50 : index + 1,
                transform: `translateY(${Math.abs(offset) * 2}px) rotate(${offset * 2.5}deg)`,
              }}
              className="demo-match-hand__slot"
            >
              <div
                data-flip={`hand:${ref}`}
                className="dm-deal-in"
                style={{ "--dm-delay": `${250 + index * 90}ms` } as CSSProperties}
              >
                <GameCard
                  card={cardOf(ref)}
                  size="fluid-hand"
                  pulse={pulseHand(expect, ref)}
                  coachId={`coach-hand-${ref}`}
                  onClick={pulseHand(expect, ref) ? () => tryAction({ type: "hand", card: ref }) : undefined}
                />
              </div>
            </div>
          );
        })}
        {state.hand.length === 0 ? <span className="text-sm text-muted">—</span> : null}
      </div>
    </div>
  );
}
