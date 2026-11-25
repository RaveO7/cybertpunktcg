"use client";

import { useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CoachCallout } from "@/components/CoachCallout";
import { GameCard } from "@/components/GameCard";
import { ActionButtons } from "@/components/demo-match/ActionButtons";
import { demoDensityVars } from "@/components/demo-match/density";
import { HandRow } from "@/components/demo-match/HandRow";
import { RivalRow } from "@/components/demo-match/RivalRow";
import { EddiesBlock, FixerBlock, LegendsBlock, PilesBlock } from "@/components/demo-match/SideBlocks";
import { TableOverlays } from "@/components/demo-match/TableOverlays";
import { useCompact } from "@/components/demo-match/use-compact";
import { useDemoMatch } from "@/components/demo-match/use-demo-match";
import { YourField, YourGigsBox } from "@/components/demo-match/YourFieldZone";
// Styles du tutoriel (classes .demo-*, .dm-*, aussi utilisées par GameCard et CoachCallout) : importés ici
// pour ne charger cette feuille que sur les pages du tutoriel, pas dans la feuille globale bloquante.
import "./demo-match.css";
import { cardOf } from "@/lib/rules/demo-match";

export function DemoMatch({
  onOpenRules,
  onProgress,
}: {
  onOpenRules: () => void;
  onProgress?: (step: number, total: number) => void;
}) {
  const { copy, steps, stepIndex, step, expect, done, state, toast, fxSeq, round, fx, tableRef, tryAction, restart } =
    useDemoMatch(onProgress);
  const compact = useCompact();

  const densityStyle = useMemo(() => demoDensityVars(state, compact), [state, compact]);

  const burst = (flashes: string[], color: string) =>
    state.flash && fxSeq > 0 && flashes.some((f) => (f.endsWith("*") ? state.flash!.startsWith(f.slice(0, -1)) : state.flash === f)) ? (
      <span key={`burst-${fxSeq}`} className="dm-burst" style={{ "--dm-fx-color": color } as CSSProperties} aria-hidden />
    ) : null;

  const stepLabel = `${copy.tipLabel} ${stepIndex + 1}/${steps.length}`;
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);

  const rivalTurnActive = state.phase === "rival" && expect.kind === "continue";
  const pulseYourGigs =
    step.anchor === "coach-your-gigs" || (state.rivalAttackerId != null && expect.kind === "continue");

  // Rival + mid hug content; hand absorbs leftover height.
  const gridRows = "auto auto minmax(0, 1fr)";
  const hasButton =
    expect.kind === "begin" ||
    expect.kind === "continue" ||
    expect.kind === "end-turn" ||
    done;

  const actionButtons = (
    <ActionButtons
      copy={copy}
      expect={expect}
      done={done}
      compact={compact}
      tryAction={tryAction}
      restart={restart}
      onOpenRules={onOpenRules}
    />
  );
  const overlays = (
    <TableOverlays
      copy={copy}
      fx={fx}
      fxSeq={fxSeq}
      toast={toast}
      rivalTurnActive={rivalTurnActive}
      compact={compact}
    />
  );
  const rivalRow = (
    <RivalRow copy={copy} state={state} expect={expect} compact={compact} tryAction={tryAction} burst={burst} />
  );
  const yourGigsBox = (
    <YourGigsBox copy={copy} state={state} compact={compact} pulse={pulseYourGigs} burst={burst} />
  );
  const yourField = <YourField copy={copy} state={state} expect={expect} tryAction={tryAction} />;
  const fixerBlock = (
    <FixerBlock copy={copy} state={state} expect={expect} compact={compact} tryAction={tryAction} />
  );
  const legendsBlock = (
    <LegendsBlock copy={copy} state={state} expect={expect} tryAction={tryAction} burst={burst} />
  );
  const pilesBlock = <PilesBlock copy={copy} state={state} />;
  const eddiesBlock = (
    <EddiesBlock copy={copy} state={state} expect={expect} tryAction={tryAction} burst={burst} />
  );
  const handRow = <HandRow copy={copy} state={state} expect={expect} tryAction={tryAction} />;

  const tableClass =
    "demo-match-table relative grid h-full min-h-0 flex-1 overflow-hidden border border-line bg-[radial-gradient(ellipse_at_center,_rgba(62,224,255,0.07),_transparent_55%),linear-gradient(180deg,#0c1018_0%,#07080d_100%)] p-[var(--dm-pad)]";

  if (compact) {
    return createPortal(
      <div
        // Portail hors de la page : ses balayages ne doivent pas changer d'onglet (voir HowToPlayScreen).
        data-swipe-zone=""
        className="demo-match demo-match--compact pt-safe px-safe pb-safe fixed inset-0 z-[60] grid bg-background portrait:grid-rows-[minmax(0,1fr)_auto] landscape:grid-cols-[minmax(0,1fr)_clamp(11.5rem,32vw,18rem)]"
        style={densityStyle}
      >
        <CoachCallout key={done ? "done" : step.id} anchorId={done ? "coach-done" : step.anchor} ringOnly />

        <div key={round} ref={tableRef} className={tableClass} style={{ gap: "var(--dm-gap)", gridTemplateRows: gridRows }}>
          {overlays}
          {rivalRow}
          <div className="demo-match-mid shrink-0">
            <div className="demo-match-mid__zone">
              {yourGigsBox}
              {yourField}
            </div>
            <div className="demo-match-mid__left flex flex-col gap-[var(--dm-gap)]">
              {fixerBlock}
              {legendsBlock}
            </div>
            <div className="demo-match-mid__right flex flex-col items-end gap-[var(--dm-gap)]">
              {pilesBlock}
              {eddiesBlock}
            </div>
          </div>
          {handRow}
        </div>

        <aside className="flex min-h-0 flex-col gap-2 border-line bg-panel p-3 portrait:max-h-[40dvh] portrait:border-t landscape:border-l landscape:p-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[0.65rem] tracking-[0.12em] whitespace-nowrap text-yellow uppercase">
              {stepLabel}
            </span>
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden border border-line bg-black/40"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-yellow transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              onClick={onOpenRules}
              className="-my-1 flex size-9 shrink-0 items-center justify-center border border-line text-muted hover:text-foreground"
              aria-label={copy.exit}
              title={copy.exit}
            >
              ✕
            </button>
          </div>
          <div key={step.id} className="dm-coach-in min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <p className="text-sm leading-snug font-medium text-foreground">{step.title}</p>
            <p className="mt-1 text-[0.8rem] leading-snug text-muted">{step.explain}</p>
          </div>
          {hasButton ? (
            <div className="flex shrink-0 gap-2">{actionButtons}</div>
          ) : (
            <p key={`tip-${step.id}`} className="dm-coach-in shrink-0 border-l-2 border-yellow pl-2 text-xs leading-snug text-yellow">
              {step.tip}
            </p>
          )}
        </aside>
      </div>,
      document.body,
    );
  }

  return (
    <div className="demo-match relative flex min-h-0 flex-1 flex-col overflow-hidden" style={densityStyle}>
      {hasButton ? (
        <div className="absolute top-2 right-2 z-30 flex flex-wrap items-center justify-end gap-2">
          {actionButtons}
        </div>
      ) : null}

      <CoachCallout
        key={done ? "done" : step.id}
        anchorId={done ? "coach-done" : step.anchor}
        title={step.title}
        body={step.explain}
        stepLabel={stepLabel}
      />

      <div key={round} ref={tableRef} className={tableClass} style={{ gap: "var(--dm-gap)", gridTemplateRows: gridRows }}>
        {overlays}
        {rivalRow}

        <div className="relative shrink-0">
          <div className="absolute top-0 left-1/2 z-10 flex w-max max-w-full -translate-x-1/2 flex-col items-center gap-[var(--dm-gap)]">
            {yourGigsBox}
            {yourField}
          </div>

          <div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-start" style={{ gap: "var(--dm-gap)" }}>
            <div className="flex shrink-0 flex-col gap-[var(--dm-gap)]">
              {fixerBlock}
              {legendsBlock}
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
                  {state.field.length === 0 && !state.pendingPlay ? (
                    <span className="text-sm">—</span>
                  ) : (
                    [...state.field.map((c) => c.ref), ...(state.pendingPlay ? [state.pendingPlay] : [])].map(
                      (ref, i) => (
                        <div key={`ph-${i}`} className="demo-match-card-row__slot">
                          <GameCard card={cardOf(ref)} size="fluid-md" dimmed />
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {pilesBlock}
              {eddiesBlock}
            </div>
          </div>
        </div>

        {handRow}
      </div>
    </div>
  );
}
