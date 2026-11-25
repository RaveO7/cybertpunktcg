import { GameCard } from "@/components/GameCard";
import { cardOf, type DemoTableCopy } from "@/lib/rules/demo-match";
import type { MatchState } from "@/lib/rules/demo-match-state";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";
import { FX_COLOR } from "./fx";
import type { BurstFn, TryAction } from "./types";

export function RivalRow({
  copy,
  state,
  expect,
  compact,
  tryAction,
  burst,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  expect: ExpectAction;
  compact: boolean;
  tryAction: TryAction;
  burst: BurstFn;
}) {
  return (
    <div
      className="flex shrink-0 items-end justify-between border-b border-line/50 pb-[var(--dm-gap)]"
      style={{ gap: "var(--dm-gap)" }}
    >
      <button
        type="button"
        data-coach-id="coach-rival-gigs"
        onClick={() => tryAction({ type: "target-gigs" })}
        className={`relative shrink-0 self-end border text-left transition ${
          compact ? "min-w-[5.5rem] px-1.5 py-1" : "min-w-[6.5rem] px-2 py-1.5"
        } ${
          expect.kind === "target-gigs"
            ? "dm-target border-yellow bg-yellow/15"
            : "border-danger/40 bg-danger/5"
        }`}
      >
        {burst(["steal", "finale", "rival-gig"], FX_COLOR.rival)}
        <p className="demo-hud-label text-danger">{copy.rivalGigs}</p>
        <div className="demo-match-gigs mt-1">
          {state.rivalGigs.length === 0 ? (
            <span className="text-xs text-muted">—</span>
          ) : (
            state.rivalGigs.map((v, i) => (
              <span
                key={`rg-${i}`}
                className="dm-dice-roll inline-flex size-[var(--dm-gig)] shrink-0 items-center justify-center border border-danger/50 bg-black/40 font-mono text-xs text-danger"
              >
                {v}
              </span>
            ))
          )}
        </div>
      </button>

      <div className="min-w-0 flex-1 self-end overflow-hidden" data-coach-id="coach-rival-field">
        <p className="demo-hud-label mb-1 text-danger">{copy.rivalField}</p>
        <div className="demo-match-card-row demo-match-card-row--rival">
          {state.rivalField.map((c, index) => (
            <div
              key={c.id}
              className="demo-match-card-row__slot"
              style={{
                zIndex:
                  state.rivalAttackerId === c.id ||
                  (expect.kind === "target-rival" && (expect.ref == null || expect.ref === c.ref))
                    ? 50
                    : index + 1,
              }}
            >
              <div data-fx-id={c.id} data-flip={`rival:${c.id}`} className="dm-drop-in">
                <GameCard
                  card={cardOf(c.ref)}
                  size="fluid-rival"
                  spent={c.spent}
                  pulse={
                    state.rivalAttackerId === c.id ||
                    (expect.kind === "target-rival" && (expect.ref == null || expect.ref === c.ref))
                  }
                  coachId={c.ref === "unitJackie" ? "coach-rival-unitJackie" : undefined}
                  onClick={
                    expect.kind === "target-rival"
                      ? () => tryAction({ type: "target-rival", ref: c.ref })
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
          {state.rivalField.length === 0 ? <span className="text-xs text-muted">—</span> : null}
        </div>
      </div>
    </div>
  );
}
