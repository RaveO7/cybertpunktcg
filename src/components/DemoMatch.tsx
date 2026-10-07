"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CoachCallout } from "@/components/CoachCallout";
import { playCardMoves, takeFlipSnapshot, type FlipSnapshot } from "@/components/demo-card-moves";
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

// Téléphone (portrait ou paysage) : tutoriel plein écran avec panneau coach ancré.
const COMPACT_QUERY = "(max-width: 767.98px), (max-height: 599.98px)";

function subscribeCompact(onChange: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getCompact() {
  return window.matchMedia(COMPACT_QUERY).matches;
}

function getServerCompact() {
  return false;
}

function pulseDie(expect: ExpectAction, die: string) {
  return expect.kind === "die" && expect.die === die;
}

function pulseHand(expect: ExpectAction, card: CardRef) {
  return expect.kind === "hand" && expect.card === card;
}

function pulseField(expect: ExpectAction, ref: CardRef) {
  return expect.kind === "field" && expect.ref === ref;
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

/** Chevauchement juste suffisant pour que `count` cartes tiennent dans `avail` (au moins `min` × largeur). */
function fitOverlap(count: number, card: string, avail: string, min: number): string {
  if (count <= 1) return "0px";
  return `max(calc(var(${card}) * ${min}), calc((${count} * var(${card}) - ${avail}) / ${count - 1}))`;
}

function demoDensityVars(state: MatchState, compact: boolean): CSSProperties {
  const fieldN = state.field.length + (state.pendingPlay ? 1 : 0);
  const rivalN = state.rivalField.length;
  const handN = state.hand.length;
  const gigN = Math.max(state.yourGigs.length, state.rivalGigs.length);

  if (compact) {
    // Tailles en unités de conteneur (cf. .demo-match--compact) : on ne chevauche que si la place manque.
    return {
      "--dm-hand-overlap": fitOverlap(handN, "--dm-card-hand", "100cqw - 1rem", 0.2),
      "--dm-row-overlap": fitOverlap(fieldN, "--dm-card-md", "var(--dm-field-avail)", 0),
      "--dm-rival-overlap": fitOverlap(rivalN, "--dm-card-rival", "100cqw - 7.5rem", 0.15),
    } as CSSProperties;
  }

  const vars: Record<string, string> = {
    // La largeur des cartes suit la hauteur de la main : chevauchement relatif, élargi si la place manque.
    "--dm-hand-overlap": fitOverlap(handN, "--dm-card-hand", "100cqw - 1rem", 0.4),
    "--dm-row-overlap": rowOverlap(fieldN),
    "--dm-rival-overlap": rivalOverlap(rivalN),
  };

  if (fieldN >= 4) vars["--dm-card-md"] = "clamp(3.75rem, 9vh, 7.5rem)";
  else if (fieldN === 3) vars["--dm-card-md"] = "clamp(4rem, 10vh, 8.25rem)";

  if (gigN >= 5) vars["--dm-gig"] = "clamp(1.45rem, 2.6vmin, 2rem)";
  else if (gigN >= 4) vars["--dm-gig"] = "clamp(1.65rem, 3vmin, 2.35rem)";

  return vars as CSSProperties;
}

type FxTone = "you" | "rival" | "info";

const FX_COLOR: Record<FxTone, string> = {
  you: "#f5e642",
  rival: "#ff5d6c",
  info: "#3ee0ff",
};

type Fx = {
  tone: FxTone;
  banner?: string;
  sub?: string;
  shake?: boolean;
  vignette?: boolean;
  hold?: boolean;
  confetti?: boolean;
};

/** Effet visuel associé à chaque action du tutoriel (state.flash). */
function fxFor(flash: string | null, copy: ReturnType<typeof demoTableCopy>): Fx | null {
  if (!flash) return null;
  const f = copy.fx;
  if (flash.startsWith("gig-")) return { tone: "you", banner: f.gig, sub: f.streetCred(flash.slice(4)) };
  if (flash.startsWith("play-")) return { tone: "you", banner: f.deployed };
  switch (flash) {
    case "begin":
      return { tone: "you", banner: f.begin, vignette: true };
    case "sell":
      return { tone: "you", banner: f.sell };
    case "call-legend":
      return { tone: "info", banner: f.legend, vignette: true };
    case "equip":
      return { tone: "info", banner: f.equip };
    case "steal":
      return { tone: "you", banner: f.steal, shake: true, vignette: true };
    case "fight":
      return { tone: "you", banner: f.fight, shake: true, vignette: true };
    case "end-turn":
      return { tone: "rival", banner: f.rivalTurn };
    case "rival-play":
      return { tone: "rival", banner: f.rivalPlay };
    case "rival-attack":
    case "rival-attack-gigs":
      return { tone: "rival", banner: f.attack, shake: true, vignette: true };
    case "rival-steal":
      return { tone: "rival", banner: f.lost, shake: true, vignette: true };
    case "block":
      return { tone: "info", banner: f.block, shake: true, vignette: true };
    case "finale":
      return { tone: "you", banner: f.win, sub: f.winSub, hold: true, confetti: true, vignette: true };
    default:
      return null;
  }
}

const CONFETTI_COLORS = ["#f5e642", "#3ee0ff", "#ff2ea6", "#ffffff"];
const CONFETTI = Array.from({ length: 48 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2 + (i % 3) * 0.35;
  const dist = 0.55 + ((i * 37) % 45) / 100;
  return {
    "--x": `${(Math.cos(angle) * 42 * dist).toFixed(1)}cqw`,
    "--y": `${(Math.sin(angle) * 34 * dist - 12).toFixed(1)}cqh`,
    "--r": `${((i * 47) % 360) - 180}deg`,
    "--d": `${(i % 6) * 45}ms`,
    "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  } as CSSProperties;
});

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // fxSeq rejoue les effets à chaque action ; round redistribue tout au « Rejouer ».
  const [fxSeq, setFxSeq] = useState(0);
  const [round, setRound] = useState(0);
  const lunges = useRef<{ you: string[]; rival: string[] }>({ you: [], rival: [] });
  const tableRef = useRef<HTMLDivElement>(null);
  const flipSnap = useRef<FlipSnapshot | null>(null);
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);

  const step = steps[stepIndex];
  const expect = step.expect;
  const done = expect.kind === "done";

  useEffect(() => {
    onProgress?.(stepIndex + 1, steps.length);
  }, [onProgress, stepIndex, steps.length]);

  const densityStyle = useMemo(() => demoDensityVars(state, compact), [state, compact]);

  function tryAction(action: Parameters<typeof matchesExpect>[1]) {
    if (done) return;
    if (!matchesExpect(expect, action)) {
      setToast(copy.wrong);
      window.setTimeout(() => setToast(null), 1400);
      return;
    }
    const next = step.apply(state);
    flipSnap.current =
      tableRef.current && !prefersReducedMotion() ? takeFlipSnapshot(tableRef.current, state) : null;
    // Cartes qui viennent d'attaquer / bloquer : elles bondissent vers leur cible.
    const wasSpent = new Set(state.field.filter((c) => c.spent).map((c) => c.id));
    lunges.current = {
      you: next.field.filter((c) => c.spent && !wasSpent.has(c.id)).map((c) => c.id),
      rival: next.rivalAttackerId && next.rivalAttackerId !== state.rivalAttackerId ? [next.rivalAttackerId] : [],
    };
    setState({ ...next, flash: next.flash });
    setFxSeq((n) => n + 1);
    setToast(null);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function restart() {
    flipSnap.current = null;
    setState(initialMatchState());
    setStepIndex(0);
    setToast(null);
    lunges.current = { you: [], rival: [] };
    setRound((n) => n + 1);
  }

  const fx = fxSeq > 0 ? fxFor(state.flash, copy) : null;
  const fxColor = fx ? FX_COLOR[fx.tone] : FX_COLOR.you;
  const shake = Boolean(fx?.shake);

  // Web Animations : rejouables sans remonter les cartes (qui rejoueraient leur arrivée).
  useEffect(() => {
    const table = tableRef.current;
    if (!table || fxSeq === 0 || prefersReducedMotion()) return;
    const lunge = (id: string, dir: 1 | -1, glow: string) =>
      table.querySelector(`[data-fx-id="${id}"]`)?.animate(
        [
          { transform: "none" },
          {
            transform: `translateY(${dir * 34}%) scale(1.15) rotate(${dir * 4}deg)`,
            filter: `drop-shadow(0 0 16px ${glow})`,
            offset: 0.35,
          },
          { transform: "none" },
        ],
        { duration: 560, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
      );
    lunges.current.you.forEach((id) => lunge(id, -1, "rgba(245, 230, 66, 0.9)"));
    lunges.current.rival.forEach((id) => lunge(id, 1, "rgba(255, 93, 108, 0.9)"));
    lunges.current = { you: [], rival: [] };
  }, [fxSeq]);

  // Cartes qui changent de zone : elles volent de l'ancienne position à la nouvelle (avant peinture).
  useLayoutEffect(() => {
    const snap = flipSnap.current;
    flipSnap.current = null;
    if (snap && tableRef.current) playCardMoves(tableRef.current, snap, state);
  }, [state]);

  // Impact : le plateau tremble.
  useEffect(() => {
    if (!shake || prefersReducedMotion()) return;
    tableRef.current?.animate(
      [
        { translate: "0 0" },
        { translate: "-5px 1px" },
        { translate: "5px -1px" },
        { translate: "-4px 0" },
        { translate: "3px 1px" },
        { translate: "-1px 0" },
        { translate: "0 0" },
      ],
      { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  }, [fxSeq, shake]);

  const fxStyle = { "--dm-fx-color": fxColor } as CSSProperties;
  const burst = (flashes: string[], color: string) =>
    state.flash && fxSeq > 0 && flashes.some((f) => (f.endsWith("*") ? state.flash!.startsWith(f.slice(0, -1)) : state.flash === f)) ? (
      <span key={`burst-${fxSeq}`} className="dm-burst" style={{ "--dm-fx-color": color } as CSSProperties} aria-hidden />
    ) : null;

  const handFan = state.hand.length;
  const stepLabel = `${copy.tipLabel} ${stepIndex + 1}/${steps.length}`;
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);

  const lastTrash = state.trash.length > 0 ? state.trash[state.trash.length - 1] : null;
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

  const btn = compact ? "flex-1 px-4 py-2.5 text-sm" : "px-4 py-2 text-sm";
  const actionButtons: ReactNode = (
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

  const rivalRow = (
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
                locale={locale}
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

  const yourGigsBox = (
    <div
      data-coach-id="coach-your-gigs"
      className={`relative shrink-0 border transition ${compact ? "px-2 py-1" : "px-3 py-2"} ${
        pulseYourGigs
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

  const yourField = (
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
              locale={locale}
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
              <GameCard card={cardOf(state.pendingPlay)} size="fluid-md" locale={locale} />
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

  const fixerBlock = (
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

  const legendsBlock = (
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
              locale={locale}
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

  const pilesBlock = (
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
          <GameCard card={cardOf(lastTrash)} size="fluid-pile" locale={locale} dimmed />
        </div>
      ) : (
        <div data-flip="trash" className="aspect-card w-full border border-dashed border-line/40 bg-black/20" aria-hidden />
      )}
    </div>
  );

  const eddiesBlock = (
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
              locale={locale}
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

  const handRow = (
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
                locale={locale}
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

  const overlays = (
    <>
      {fx ? (
        <div key={`fx-${fxSeq}`} className="contents" style={fxStyle} aria-hidden>
          {fx.vignette ? <div className="dm-vignette" /> : null}
          {fx.banner ? (
            <div className={`dm-banner ${fx.hold ? "dm-banner--hold" : ""}`}>
              <div className="dm-banner__bar">
                <span className="dm-banner__text">{fx.banner}</span>
                {fx.sub ? <span className="dm-banner__sub">{fx.sub}</span> : null}
              </div>
            </div>
          ) : null}
          {fx.confetti ? (
            <div className="dm-confetti">
              {CONFETTI.map((style, i) => (
                <i key={i} style={style} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <p
          key={toast + fxSeq}
          className="dm-nope absolute top-1 left-1/2 z-30 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 border border-danger/40 bg-black/90 px-2 py-1 text-center text-xs text-danger"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      {rivalTurnActive ? (
        <span className={`absolute top-1 z-20 border ${compact ? "left-1/2 -translate-x-1/2" : "left-1"} border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-danger`}>
          {copy.rivalPhase}
        </span>
      ) : null}
    </>
  );

  const tableClass =
    "demo-match-table relative grid h-full min-h-0 flex-1 overflow-hidden border border-line bg-[radial-gradient(ellipse_at_center,_rgba(62,224,255,0.07),_transparent_55%),linear-gradient(180deg,#0c1018_0%,#07080d_100%)] p-[var(--dm-pad)]";

  if (compact) {
    return createPortal(
      <div
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
                          <GameCard card={cardOf(ref)} size="fluid-md" locale={locale} dimmed />
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
