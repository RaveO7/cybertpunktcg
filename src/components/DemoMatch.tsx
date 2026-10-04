"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CoachCallout } from "@/components/CoachCallout";
import { GameCard } from "@/components/GameCard";
import {
  buildInteractiveSteps,
  cardOf,
  demoTableCopy,
  initialMatchState,
  matchesExpect,
  type CardRef,
  type DemoLocale,
  type ExpectAction,
  type MatchState,
} from "@/lib/rules/demo-match";

function pulseDie(expect: ExpectAction, die: string) {
  return expect.kind === "die" && expect.die === die;
}

function pulseHand(expect: ExpectAction, card: CardRef) {
  return expect.kind === "hand" && expect.card === card;
}

function pulseField(expect: ExpectAction, ref: CardRef) {
  return expect.kind === "field" && expect.ref === ref;
}

function handOverlap(count: number): string {
  if (count <= 1) return "0px";
  if (count <= 3) return "clamp(2rem, 5vh, 3rem)";
  if (count <= 5) return "clamp(3rem, 7vh, 4.25rem)";
  return "clamp(3.75rem, 9vh, 5.5rem)";
}

function rowOverlap(count: number): string {
  if (count <= 1) return "0px";
  if (count <= 2) return "clamp(0.65rem, 1.5vmin, 1rem)";
  return "clamp(1.25rem, 3.5vmin, 2.25rem)";
}

function rivalOverlap(count: number): string {
  if (count <= 1) return "0px";
  if (count === 2) return "clamp(1.75rem, 4vh, 3rem)";
  if (count === 3) return "clamp(2.5rem, 6vh, 4rem)";
  return "clamp(3.25rem, 8vh, 5rem)";
}

function demoDensityVars(state: MatchState): CSSProperties {
  const fieldN = state.field.length;
  const rivalN = state.rivalField.length;
  const handN = state.hand.length;
  const gigN = Math.max(state.yourGigs.length, state.rivalGigs.length);

  const vars: Record<string, string> = {
    "--dm-hand-overlap": handOverlap(handN),
    "--dm-row-overlap": rowOverlap(fieldN),
    "--dm-rival-overlap": rivalOverlap(rivalN),
  };

  if (fieldN >= 4) vars["--dm-card-md"] = "clamp(3.75rem, 9vh, 7.5rem)";
  else if (fieldN === 3) vars["--dm-card-md"] = "clamp(4rem, 10vh, 8.25rem)";

  if (handN >= 6) vars["--dm-hand-overlap"] = "clamp(4rem, 10vh, 6rem)";
  else if (handN >= 5) vars["--dm-hand-overlap"] = "clamp(3.5rem, 8vh, 5rem)";

  if (gigN >= 5) vars["--dm-gig"] = "clamp(1.45rem, 2.6vmin, 2rem)";
  else if (gigN >= 4) vars["--dm-gig"] = "clamp(1.65rem, 3vmin, 2.35rem)";

  return vars as CSSProperties;
}

export function DemoMatch({
  locale,
  onOpenRules,
  onProgress,
}: {
  locale: DemoLocale;
  onOpenRules: () => void;
  onProgress?: (step: number, total: number) => void;
}) {
  const copy = useMemo(() => demoTableCopy(locale), [locale]);
  const steps = useMemo(() => buildInteractiveSteps(locale), [locale]);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<MatchState>(() => initialMatchState());
  const [toast, setToast] = useState<string | null>(null);

  const step = steps[stepIndex];
  const expect = step.expect;
  const done = expect.kind === "done";

  useEffect(() => {
    onProgress?.(stepIndex + 1, steps.length);
  }, [onProgress, stepIndex, steps.length]);

  const densityStyle = useMemo(() => demoDensityVars(state), [state]);

  function tryAction(action: Parameters<typeof matchesExpect>[1]) {
    if (done) return;
    if (!matchesExpect(expect, action)) {
      setToast(copy.wrong);
      window.setTimeout(() => setToast(null), 1400);
      return;
    }
    const next = step.apply(state);
    setState({ ...next, flash: next.flash });
    setToast(null);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function restart() {
    setState(initialMatchState());
    setStepIndex(0);
    setToast(null);
  }

  const handFan = state.hand.length;
  const stepLabel = `${copy.tipLabel} ${stepIndex + 1}/${steps.length}`;

  const lastTrash = state.trash.length > 0 ? state.trash[state.trash.length - 1] : null;
  const rivalTurnActive = state.phase === "rival" && expect.kind === "continue";
  const pulseYourGigs =
    step.anchor === "coach-your-gigs" || (state.rivalAttackerId != null && expect.kind === "continue");

  // Rival + mid hug content; hand absorbs leftover height.
  const gridRows = "auto auto minmax(0, 1fr)";
  const showDock =
    expect.kind === "begin" ||
    expect.kind === "continue" ||
    expect.kind === "end-turn" ||
    done;

  return (
    <div
      className="demo-match relative flex min-h-0 flex-1 flex-col overflow-hidden"
      style={densityStyle}
    >
      {toast ? (
        <p
          className="absolute top-1 left-1/2 z-30 -translate-x-1/2 border border-danger/40 bg-black/90 px-2 py-1 text-xs text-danger"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      {rivalTurnActive ? (
        <span className="absolute top-1 left-1 z-20 border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-danger">
          {copy.rivalPhase}
        </span>
      ) : null}

      {showDock ? (
        <div className="absolute top-2 right-2 z-30 flex flex-wrap items-center justify-end gap-2">
          {expect.kind === "begin" ? (
            <button
              type="button"
              data-coach-id="coach-begin"
              onClick={() => tryAction({ type: "begin" })}
              className="animate-pulse border border-yellow bg-yellow px-4 py-2 text-sm font-medium text-black shadow-lg"
            >
              {copy.begin}
            </button>
          ) : null}
          {expect.kind === "continue" ? (
            <button
              type="button"
              data-coach-id="coach-continue"
              onClick={() => tryAction({ type: "continue" })}
              className="animate-pulse border border-danger bg-danger/20 px-4 py-2 text-sm text-danger shadow-lg backdrop-blur-sm"
            >
              {copy.next}
            </button>
          ) : null}
          {expect.kind === "end-turn" ? (
            <button
              type="button"
              data-coach-id="coach-end-turn"
              onClick={() => tryAction({ type: "end-turn" })}
              className="animate-pulse border border-yellow bg-yellow px-4 py-2 text-sm font-medium text-black shadow-lg"
            >
              {copy.endTurn}
            </button>
          ) : null}
          {done ? (
            <div data-coach-id="coach-done" className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={restart}
                className="border border-yellow bg-yellow px-4 py-2 text-sm text-black shadow-lg"
              >
                {copy.restart}
              </button>
              <button
                type="button"
                onClick={onOpenRules}
                className="border border-cyan bg-cyan/15 px-4 py-2 text-sm text-cyan shadow-lg backdrop-blur-sm"
              >
                {copy.openRules}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!done ? (
        <CoachCallout
          key={step.id}
          anchorId={step.anchor}
          title={step.title}
          body={step.explain}
          stepLabel={stepLabel}
        />
      ) : (
        <CoachCallout
          key="done"
          anchorId="coach-done"
          title={step.title}
          body={step.explain}
          stepLabel={stepLabel}
        />
      )}

      <div
        className="demo-match-table relative grid h-full min-h-0 flex-1 overflow-hidden border border-line bg-[radial-gradient(ellipse_at_center,_rgba(62,224,255,0.07),_transparent_55%),linear-gradient(180deg,#0c1018_0%,#07080d_100%)] p-[var(--dm-pad)]"
        style={{
          gap: "var(--dm-gap)",
          gridTemplateRows: gridRows,
        }}
      >
        <div
          className="flex shrink-0 items-end justify-between border-b border-line/50 pb-[var(--dm-gap)]"
          style={{ gap: "var(--dm-gap)" }}
        >
          <button
            type="button"
            data-coach-id="coach-rival-gigs"
            onClick={() => tryAction({ type: "target-gigs" })}
            className={`min-w-[6.5rem] shrink-0 self-end border px-2 py-1.5 text-left transition ${
              expect.kind === "target-gigs"
                ? "animate-pulse border-yellow bg-yellow/15"
                : "border-danger/40 bg-danger/5"
            }`}
          >
            <p className="demo-hud-label text-danger">{copy.rivalGigs}</p>
            <div className="demo-match-gigs mt-1">
              {state.rivalGigs.length === 0 ? (
                <span className="text-xs text-muted">—</span>
              ) : (
                state.rivalGigs.map((v, i) => (
                  <span
                    key={`rg-${i}`}
                    className="inline-flex size-[var(--dm-gig)] shrink-0 items-center justify-center border border-danger/50 bg-black/40 font-mono text-xs text-danger"
                  >
                    {v}
                  </span>
                ))
              )}
            </div>
          </button>

          <div
            className="min-w-0 flex-1 self-end overflow-hidden"
            data-coach-id="coach-rival-field"
          >
            <p className="demo-hud-label mb-1 text-danger">{copy.rivalField}</p>
            <div className="demo-match-card-row demo-match-card-row--rival">
              {state.rivalField.map((c, index) => (
                <div key={c.id} className="demo-match-card-row__slot" style={{ zIndex: index + 1 }}>
                  <GameCard
                    card={cardOf(c.ref)}
                    size="fluid-rival"
                    spent={c.spent}
                    pulse={
                      state.rivalAttackerId === c.id ||
                      (expect.kind === "target-rival" && (expect.ref == null || expect.ref === c.ref))
                    }
                    locale={locale}
                    coachId={c.ref === "unitJackie" ? "coach-rival-unitJackie" : undefined}
                    onClick={
                      expect.kind === "target-rival"
                        ? () => tryAction({ type: "target-rival", ref: c.ref })
                        : undefined
                    }
                  />
                </div>
              ))}
              {state.rivalField.length === 0 ? <span className="text-xs text-muted">—</span> : null}
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          <div className="absolute top-0 left-1/2 z-10 flex w-max max-w-full -translate-x-1/2 flex-col items-center gap-[var(--dm-gap)]">
            <div
              data-coach-id="coach-your-gigs"
              className={`shrink-0 border px-3 py-2 transition ${
                pulseYourGigs
                  ? "animate-pulse border-yellow bg-yellow/15 shadow-[0_0_16px_rgba(245,230,66,0.35)]"
                  : "border-yellow/30 bg-yellow/5"
              }`}
            >
              <p className="demo-hud-label text-center text-yellow">{copy.yourGigs}</p>
              <div className="demo-match-gigs mt-1 justify-center">
                {state.yourGigs.length === 0 ? (
                  <span className="text-xs text-muted">0</span>
                ) : (
                  state.yourGigs.map((v, i) => (
                    <span
                      key={`yg-${i}`}
                      className="inline-flex size-[var(--dm-gig)] shrink-0 items-center justify-center border border-yellow/60 bg-black/50 font-mono text-xs text-yellow"
                    >
                      {v}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="w-full min-w-0">
              <p className="demo-hud-label mb-1 text-center text-cyan">{copy.yourField}</p>
              <div className="demo-match-card-row">
                {state.field.map((c, index) => (
                  <div key={c.id} className="demo-match-card-row__slot" style={{ zIndex: index + 1 }}>
                    <GameCard
                      card={cardOf(c.ref)}
                      size="fluid-md"
                      spent={c.spent}
                      selected={state.selectedAttackerId === c.id}
                      pulse={pulseField(expect, c.ref) && !c.spent}
                      equipped={c.equipped ? cardOf(c.equipped) : null}
                      locale={locale}
                      coachId={`coach-field-${c.ref}`}
                      onClick={
                        pulseField(expect, c.ref)
                          ? () => tryAction({ type: "field", ref: c.ref, id: c.id })
                          : undefined
                      }
                    />
                  </div>
                ))}
                {state.field.length === 0 ? (
                  <span className="self-center text-sm text-muted">—</span>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="grid shrink-0 grid-cols-[auto_1fr_auto] items-start"
            style={{ gap: "var(--dm-gap)" }}
          >
            <div className="flex shrink-0 flex-col gap-[var(--dm-gap)]">
              <div className="min-w-0">
                <p className="demo-hud-label mb-1">{copy.fixer}</p>
                <div className="flex flex-nowrap gap-1">
                  {state.fixer.map((die) => {
                    const active = pulseDie(expect, die);
                    return (
                      <button
                        key={die}
                        type="button"
                        data-coach-id={`coach-die-${die}`}
                        onClick={() => tryAction({ type: "die", die })}
                        className={[
                          "inline-flex size-[var(--dm-die)] shrink-0 items-center justify-center border font-mono text-xs transition sm:text-sm",
                          active
                            ? "animate-pulse border-yellow bg-yellow text-black"
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
              <div>
                <p className="demo-hud-label mb-1">{copy.legends}</p>
                <div className="flex flex-nowrap gap-1" data-coach-id="coach-legends">
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
                        locale={locale}
                        dimmed={c.spent}
                        pulse={canPay || canCall}
                        coachId={
                          isCallAnchor ? "coach-legend-call" : isPayAnchor ? "coach-legend" : undefined
                        }
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
            </div>

            {/* Placeholders : réserve la place sans lier le bloc Gigs/Field (absolu). */}
            <div className="invisible pointer-events-none flex min-w-0 flex-col items-center gap-[var(--dm-gap)]" aria-hidden>
              <div className="shrink-0 border px-3 py-2">
                <p className="demo-hud-label text-center">{copy.yourGigs}</p>
                <div className="demo-match-gigs mt-1 justify-center">
                  <span className="inline-flex size-[var(--dm-gig)] items-center justify-center font-mono text-xs">
                    0
                  </span>
                </div>
              </div>
              <div className="w-full min-w-0">
                <p className="demo-hud-label mb-1 text-center">{copy.yourField}</p>
                <div className="demo-match-card-row">
                  {state.field.length === 0 ? (
                    <span className="text-sm">—</span>
                  ) : (
                    state.field.map((c) => (
                      <div key={`ph-${c.id}`} className="demo-match-card-row__slot">
                        <GameCard card={cardOf(c.ref)} size="fluid-md" locale={locale} dimmed />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div
                className="grid shrink-0 grid-cols-2 gap-x-1.5 gap-y-1"
                style={{ width: "calc(var(--dm-pile) * 2 + 0.375rem)" }}
              >
                <p className="demo-hud-label text-center leading-none">{copy.deck}</p>
                <p className="demo-hud-label text-center leading-none">{copy.trash}</p>
                <div className="aspect-card flex w-full items-center justify-center border border-cyan/40 bg-[linear-gradient(160deg,#152033,#0a0c16)] font-mono text-xs text-cyan">
                  {state.deckCount}
                </div>
                {lastTrash ? (
                  <GameCard card={cardOf(lastTrash)} size="fluid-pile" locale={locale} dimmed />
                ) : (
                  <div className="aspect-card w-full border border-dashed border-line/40 bg-black/20" aria-hidden />
                )}
              </div>
              <div className="min-w-0" data-coach-id="coach-eddies">
                <p className="demo-hud-label mb-1 text-right">{copy.eddies}</p>
                <div className="flex flex-nowrap justify-end gap-1">
                  {state.eddies.map((c) => {
                    const canPay = expect.kind === "eddie" && !c.spent;
                    const isAnchor =
                      canPay && state.eddies.find((e) => !e.spent)?.id === c.id;
                    return (
                      <GameCard
                        key={c.id}
                        card={cardOf(c.ref)}
                        size="fluid-pile"
                        faceDown
                        spent={c.spent}
                        locale={locale}
                        dimmed={c.spent}
                        pulse={canPay}
                        coachId={isAnchor ? "coach-eddie" : undefined}
                        onClick={canPay ? () => tryAction({ type: "eddie" }) : undefined}
                      />
                    );
                  })}
                  {state.eddies.length === 0 ? <span className="text-xs text-muted">—</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  key={`${ref}-${index}`}
                  style={{
                    zIndex: index + 1,
                    transform: `translateY(${Math.abs(offset) * 2}px) rotate(${offset * 2.5}deg)`,
                  }}
                  className="demo-match-hand__slot"
                >
                  <GameCard
                    card={cardOf(ref)}
                    size="fluid-hand"
                    pulse={pulseHand(expect, ref)}
                    locale={locale}
                    coachId={`coach-hand-${ref}`}
                    onClick={
                      pulseHand(expect, ref) ? () => tryAction({ type: "hand", card: ref }) : undefined
                    }
                  />
                </div>
              );
            })}
            {state.hand.length === 0 ? <span className="text-sm text-muted">—</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
