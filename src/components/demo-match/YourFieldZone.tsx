import { GameCard } from "@/components/GameCard";
import { cardOf, type DemoTableCopy } from "@/lib/rules/demo-match";
import type { CardRef, MatchState } from "@/lib/rules/demo-match-state";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";
import { FX_COLOR } from "./fx";
import type { BurstFn, TryAction } from "./types";

function pulseField(expect: ExpectAction, ref: CardRef) {
  return expect.kind === "field" && expect.ref === ref;
}

export function YourGigsBox({
  copy,
  state,
  compact,
  pulse,
  burst,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  compact: boolean;
  pulse: boolean;
  burst: BurstFn;
}) {
  return (
    <div
      data-coach-id="coach-your-gigs"
      className={`relative shrink-0 border transition ${compact ? "px-2 py-1" : "px-3 py-2"} ${
        pulse
          ? "dm-target border-yellow bg-yellow/15 shadow-[0_0_16px_rgba(245,230,66,0.35)]"
          : "border-yellow/30 bg-yellow/5"
      }`}
    >
      {burst(["gig-*", "steal", "finale"], FX_COLOR.you)}
      {burst(["rival-steal"], FX_COLOR.rival)}
      <p className="demo-hud-label text-center text-yellow">{copy.yourGigs}</p>
      <div className="demo-match-gigs mt-1 justify-center">
        {state.yourGigs.length === 0 ? (
          <span className="text-xs text-muted">0</span>
        ) : (
          state.yourGigs.map((v, i) => (
            <span
              key={`yg-${i}`}
              className="dm-dice-roll inline-flex size-[var(--dm-gig)] shrink-0 items-center justify-center border border-yellow/60 bg-black/50 font-mono text-xs text-yellow"
            >
              {v}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function YourField({
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
  return (
    <div className="w-full min-w-0">
      <p className="demo-hud-label mb-1 text-center text-cyan">{copy.yourField}</p>
      <div className="demo-match-card-row">
        {state.field.map((c, index) => (
          <div
            key={c.id}
            className="demo-match-card-row__slot"
            style={{ zIndex: pulseField(expect, c.ref) ? 50 : index + 1 }}
          >
            <div data-fx-id={c.id} data-flip={`field:${c.id}`} className="dm-deal-in">
              <GameCard
                card={cardOf(c.ref)}
                size="fluid-md"
                spent={c.spent}
                selected={state.selectedAttackerId === c.id}
                pulse={pulseField(expect, c.ref) && !c.spent}
                equipped={c.equipped ? cardOf(c.equipped) : null}
                coachId={`coach-field-${c.ref}`}
                onClick={
                  pulseField(expect, c.ref)
                    ? () => tryAction({ type: "field", ref: c.ref, id: c.id })
                    : undefined
                }
              />
            </div>
          </div>
        ))}
        {state.pendingPlay ? (
          <div className="demo-match-card-row__slot" style={{ zIndex: state.field.length + 1 }}>
            <div data-flip="field:pending" className="dm-pending">
              <GameCard card={cardOf(state.pendingPlay)} size="fluid-md" />
              <span className="dm-pending__tag">{copy.paying}</span>
            </div>
          </div>
        ) : null}
        {state.field.length === 0 && !state.pendingPlay ? (
          <span className="self-center text-sm text-muted">—</span>
        ) : null}
      </div>
    </div>
  );
}
