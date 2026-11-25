import { GameCard } from "@/components/GameCard";
import { cardOf, type DemoTableCopy } from "@/lib/rules/demo-match";
import type { MatchState } from "@/lib/rules/demo-match-state";
import type { ExpectAction } from "@/lib/rules/demo-match-steps";
import { FX_COLOR } from "./fx";
import type { BurstFn, TryAction } from "./types";

function pulseDie(expect: ExpectAction, die: string) {
  return expect.kind === "die" && expect.die === die;
}

export function FixerBlock({
  copy,
  state,
  expect,
  compact,
  tryAction,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  expect: ExpectAction;
  compact: boolean;
  tryAction: TryAction;
}) {
  return (
    <div className="min-w-0">
      <p className="demo-hud-label mb-1">{copy.fixer}</p>
      <div className={compact ? "demo-match-dice" : "flex flex-nowrap gap-1"}>
        {state.fixer.map((die) => {
          const active = pulseDie(expect, die);
          return (
            <button
              key={die}
              type="button"
              data-coach-id={`coach-die-${die}`}
              onClick={() => tryAction({ type: "die", die })}
              className={[
                "inline-flex size-[var(--dm-die)] shrink-0 items-center justify-center border font-mono transition",
                compact ? "text-[0.65rem]" : "text-xs sm:text-sm",
                active
                  ? "dm-target border-yellow bg-yellow text-black"
                  : "border-line bg-panel-2 text-muted hover:border-cyan/50",
                die === "d20" ? "opacity-70" : "",
              ].join(" ")}
              aria-label={die}
            >
              {die}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LegendsBlock({
  copy,
  state,
  expect,
  tryAction,
  burst,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  expect: ExpectAction;
  tryAction: TryAction;
  burst: BurstFn;
}) {
  return (
    <div>
      <p className="demo-hud-label mb-1">{copy.legends}</p>
      <div className="relative flex flex-nowrap gap-1" data-coach-id="coach-legends">
        {burst(["pay-legend", "call-legend"], FX_COLOR.info)}
        {state.legends.map((c) => {
          const canPay = expect.kind === "legend" && !c.spent;
          const canCall = expect.kind === "call-legend" && c.faceDown;
          const firstPayId = state.legends.find((l) => !l.spent)?.id;
          const firstCallId = state.legends.find((l) => l.faceDown)?.id;
          const isPayAnchor = canPay && firstPayId === c.id;
          const isCallAnchor = canCall && firstCallId === c.id;
          return (
            <GameCard
              key={c.id}
              card={cardOf(c.ref)}
              size="fluid-xs"
              faceDown={c.faceDown}
              spent={c.spent}
              dimmed={c.spent}
              pulse={canPay || canCall}
              coachId={isCallAnchor ? "coach-legend-call" : isPayAnchor ? "coach-legend" : undefined}
              onClick={
                canCall
                  ? () => tryAction({ type: "call-legend" })
                  : canPay
                    ? () => tryAction({ type: "legend" })
                    : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export function PilesBlock({ copy, state }: { copy: DemoTableCopy; state: MatchState }) {
  const lastTrash = state.trash.length > 0 ? state.trash[state.trash.length - 1] : null;
  return (
    <div
      className="grid shrink-0 grid-cols-2 gap-x-1.5 gap-y-1"
      style={{ width: "calc(var(--dm-pile) * 2 + 0.375rem)" }}
    >
      <p className="demo-hud-label text-center leading-none">{copy.deck}</p>
      <p className="demo-hud-label text-center leading-none">{copy.trash}</p>
      <div
        data-flip="deck"
        className="aspect-card flex w-full items-center justify-center border border-cyan/40 bg-[linear-gradient(160deg,#152033,#0a0c16)] font-mono text-xs text-cyan">
        {state.deckCount}
      </div>
      {lastTrash ? (
        <div key={`${lastTrash}-${state.trash.length}`} data-flip="trash" className="dm-drop-in">
          <GameCard card={cardOf(lastTrash)} size="fluid-pile" dimmed />
        </div>
      ) : (
        <div data-flip="trash" className="aspect-card w-full border border-dashed border-line/40 bg-black/20" aria-hidden />
      )}
    </div>
  );
}

export function EddiesBlock({
  copy,
  state,
  expect,
  tryAction,
  burst,
}: {
  copy: DemoTableCopy;
  state: MatchState;
  expect: ExpectAction;
  tryAction: TryAction;
  burst: BurstFn;
}) {
  return (
    <div className="min-w-0" data-coach-id="coach-eddies">
      <p className="demo-hud-label mb-1 text-right">{copy.eddies}</p>
      <div className="relative flex flex-nowrap justify-end gap-1">
        {burst(["pay-eddie", "sell"], FX_COLOR.you)}
        {state.eddies.map((c) => {
          const canPay = expect.kind === "eddie" && !c.spent;
          const isAnchor = canPay && state.eddies.find((e) => !e.spent)?.id === c.id;
          return (
            <div key={c.id} data-flip={`eddie:${c.id}`} className="dm-flip-in">
              <GameCard
                card={cardOf(c.ref)}
                size="fluid-pile"
                faceDown
                spent={c.spent}
                dimmed={c.spent}
                pulse={canPay}
                coachId={isAnchor ? "coach-eddie" : undefined}
                onClick={canPay ? () => tryAction({ type: "eddie" }) : undefined}
              />
            </div>
          );
        })}
        {state.eddies.length === 0 ? <span className="text-xs text-muted">—</span> : null}
      </div>
    </div>
  );
}
