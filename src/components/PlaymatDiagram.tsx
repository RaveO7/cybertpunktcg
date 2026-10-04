"use client";

import { useState, type ReactNode } from "react";
import { EXAMPLE_CARDS, type ExampleCard, type PlaymatZoneId } from "@/lib/rules/examples";
import type { HowToPlayContent } from "@/lib/rules/howto-play";

const ZONE_ORDER: PlaymatZoneId[] = ["fixer", "rivalGig", "gig", "field", "legends", "eddies", "deck", "trash"];

type Box = { left: number; top: number; width: number; height: number };

/** Zone rectangles in % of the official playmat (cyberpunktcg.com/gameplay-guide, 3602×2102). */
const ZONE_BOXES: Record<PlaymatZoneId, Box> = {
  rivalGig: { left: 14.3, top: 1.5, width: 31.8, height: 6.3 },
  gig: { left: 54, top: 1.5, width: 31.6, height: 6.3 },
  field: { left: 14.3, top: 11.4, width: 71.3, height: 50.6 },
  fixer: { left: 3.9, top: 16.6, width: 9.6, height: 75.6 },
  legends: { left: 14.3, top: 62, width: 35.2, height: 30.2 },
  eddies: { left: 49.5, top: 62, width: 36.1, height: 30.2 },
  deck: { left: 86.1, top: 39.8, width: 10.6, height: 25 },
  trash: { left: 86.1, top: 66.4, width: 10.6, height: 25.8 },
};

const CARD_RATIO = "733 / 1024";

const FIXER_DICE = [
  { die: "d20", taken: false },
  { die: "d12", taken: false },
  { die: "d10", taken: true },
  { die: "d8", taken: false },
  { die: "d6", taken: true },
  { die: "d4", taken: true },
];
const FRIENDLY_GIGS = [
  { die: "d4", value: 4 },
  { die: "d6", value: 6 },
  { die: "d10", value: 10 },
];
const RIVAL_GIGS = [
  { die: "d4", value: 2 },
  { die: "d6", value: 5 },
  { die: "d8", value: 7 },
];

const ZONE_CARDS: Partial<Record<PlaymatZoneId, (keyof typeof EXAMPLE_CARDS)[]>> = {
  field: ["unitJackie", "gearConverter"],
  legends: ["legendJohnny"],
  eddies: ["eddieFace"],
  trash: ["programDetonate"],
};

export function PlaymatDiagram({
  areas,
  labels,
  locale,
}: {
  areas: HowToPlayContent["areas"]["items"];
  labels: HowToPlayContent["playmat"];
  locale: "fr" | "en";
}) {
  const [selected, setSelected] = useState<PlaymatZoneId>("field");
  const [hovered, setHovered] = useState<PlaymatZoneId | null>(null);
  const active = hovered ?? selected;

  const zones = ZONE_ORDER.map((id) => {
    const match = areas.find((area) => area.id === id);
    return { id, name: match?.name ?? id, body: match?.body ?? "", tips: match?.tips ?? [] };
  });
  const activeIndex = ZONE_ORDER.indexOf(active);
  const current = zones[activeIndex];
  const number = (id: PlaymatZoneId) => ZONE_ORDER.indexOf(id) + 1;

  function step(delta: number) {
    const next = (ZONE_ORDER.indexOf(selected) + delta + ZONE_ORDER.length) % ZONE_ORDER.length;
    setHovered(null);
    setSelected(ZONE_ORDER[next]);
  }

  const zone = (id: PlaymatZoneId) => ({
    number: number(id),
    active: active === id,
    pressed: selected === id,
    onSelect: () => setSelected(id),
    onHover: (on: boolean) => setHovered(on ? id : null),
  });

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-sm text-muted">{labels.hint}</p>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch">
        <div className="min-w-0 overflow-x-auto border border-line bg-[#03040c] p-2 sm:p-3">
          <div
            className="relative mx-auto w-full min-w-[46rem] max-w-5xl border border-yellow/40 bg-[radial-gradient(circle,_rgba(245,230,66,0.10)_1px,_transparent_1.5px)] bg-[length:2.2%_3.8%]"
            style={{ aspectRatio: "3602 / 2102" }}
          >
            <span className="absolute left-[1.4%] top-[3%] font-mono text-[0.7rem] font-bold tracking-[0.18em] text-yellow italic">
              CYBERPUNK <span className="text-[0.55rem] not-italic">TCG</span>
            </span>

            <ZoneButton {...zone("rivalGig")} box={ZONE_BOXES.rivalGig} label={labels.rivalGig} labelAt="bottom">
              <div className="flex h-full items-center gap-[3%] px-[4%]">
                {RIVAL_GIGS.map((die) => (
                  <Die key={die.die} die={die.die} value={die.value} muted />
                ))}
              </div>
            </ZoneButton>

            <ZoneButton {...zone("gig")} box={ZONE_BOXES.gig} label={labels.gig} labelAt="bottom">
              <div className="flex h-full items-center gap-[3%] px-[4%]">
                {FRIENDLY_GIGS.map((die) => (
                  <Die key={die.die} die={die.die} value={die.value} />
                ))}
                <span className="ml-auto font-mono text-[0.6rem] text-muted">{labels.streetCred}</span>
              </div>
            </ZoneButton>

            <ZoneButton {...zone("field")} box={ZONE_BOXES.field} label={labels.field} labelAt="top">
              <div className="flex h-full items-center justify-center gap-[3%] px-[4%] py-[4%]">
                <MatCard card={EXAMPLE_CARDS.unitJackie} height="62%" />
                <MatCard card={EXAMPLE_CARDS.unitBlocker} height="62%" />
                <div className="relative flex h-[62%] items-center">
                  <MatCard card={EXAMPLE_CARDS.unitAdrenaline} height="100%" />
                  <div className="absolute -right-[28%] -top-[10%] h-[55%] rotate-12">
                    <MatCard card={EXAMPLE_CARDS.gearConverter} height="100%" />
                  </div>
                </div>
                <div className="ml-[4%] flex h-[62%] items-center">
                  <MatCard card={EXAMPLE_CARDS.unitSmasher} height="72%" spent />
                </div>
              </div>
            </ZoneButton>

            <ZoneButton {...zone("fixer")} box={ZONE_BOXES.fixer} label={labels.fixer} labelAt="bottom">
              <div className="flex h-full flex-col items-center justify-around py-[12%]">
                {FIXER_DICE.map((die) => (
                  <span
                    key={die.die}
                    className={`inline-flex aspect-square w-[58%] items-center justify-center border font-mono text-[0.65rem] font-bold ${
                      die.taken ? "border-dashed border-yellow/30 text-yellow/30" : "border-yellow/70 bg-yellow/5 text-yellow"
                    }`}
                  >
                    {die.die.toUpperCase()}
                  </span>
                ))}
              </div>
            </ZoneButton>

            <ZoneButton {...zone("legends")} box={ZONE_BOXES.legends} label={labels.legends} labelAt="bottom">
              <div className="grid h-full grid-cols-3 gap-[3%] px-[3%] pb-[6%] pt-[4%]">
                <Slot>
                  <MatCard card={EXAMPLE_CARDS.legendJohnny} height="100%" />
                </Slot>
                <Slot>
                  <MatCard card={EXAMPLE_CARDS.legendJackie} height="100%" faceDown />
                </Slot>
                <Slot>
                  <MatCard card={EXAMPLE_CARDS.legendJudy} height="100%" faceDown />
                </Slot>
              </div>
            </ZoneButton>

            <ZoneButton {...zone("eddies")} box={ZONE_BOXES.eddies} label={labels.eddies} labelAt="bottom">
              <div className="flex h-full items-center gap-[3%] px-[5%] pb-[4%]">
                <MatCard card={EXAMPLE_CARDS.eddieFace} height="72%" faceDown />
                <MatCard card={EXAMPLE_CARDS.eddieFace} height="72%" faceDown />
                <div className="ml-[3%] flex h-[72%] items-center">
                  <MatCard card={EXAMPLE_CARDS.eddieFace} height="78%" faceDown spent />
                </div>
              </div>
            </ZoneButton>

            <ZoneButton {...zone("deck")} box={ZONE_BOXES.deck} label={labels.deck} labelAt="top">
              <div className="flex h-full items-center justify-center pt-[8%]">
                <div className="relative h-[78%]" style={{ aspectRatio: CARD_RATIO }}>
                  <div className="absolute inset-0 translate-x-[6%] translate-y-[4%] border border-line bg-panel-2" />
                  <div className="absolute inset-0 translate-x-[3%] translate-y-[2%] border border-line bg-panel-2" />
                  <div className="absolute inset-0 flex items-center justify-center border border-cyan/40 bg-[linear-gradient(160deg,#152033,#0a0c16)] font-mono text-[0.55rem] text-cyan/70">
                    40–50
                  </div>
                </div>
              </div>
            </ZoneButton>

            <ZoneButton {...zone("trash")} box={ZONE_BOXES.trash} label={labels.trash} labelAt="bottom">
              <div className="flex h-full items-center justify-center pb-[8%]">
                <MatCard card={EXAMPLE_CARDS.programDetonate} height="78%" />
              </div>
            </ZoneButton>
          </div>
        </div>

        <aside
          className="flex min-h-[22rem] min-w-0 flex-col border border-cyan/60 bg-panel xl:min-h-0"
          aria-live="polite"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan font-mono text-sm font-bold text-black">
              {activeIndex + 1}
            </span>
            <h3 className="min-w-0 text-lg text-yellow">{current.name}</h3>
          </div>
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto p-4">
            <p className="text-sm leading-relaxed break-words text-foreground">{current.body}</p>
            {current.tips.length ? (
              <ul className="space-y-2 text-sm text-muted">
                {current.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 border border-line bg-panel-2 px-3 py-2">
                    <span className="shrink-0 text-cyan" aria-hidden="true">
                      ›
                    </span>
                    <span className="min-w-0 break-words">{tip}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {ZONE_CARDS[active]?.length ? (
              <p className="border-t border-line pt-3 text-xs text-muted">
                {ZONE_CARDS[active]!
                  .map((key) => (locale === "fr" ? EXAMPLE_CARDS[key].noteFr : EXAMPLE_CARDS[key].noteEn))
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="mt-auto flex shrink-0 border-t border-line">
            <button
              type="button"
              onClick={() => step(-1)}
              className="flex-1 px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-foreground"
            >
              ← {labels.prev}
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="flex-1 border-l border-line px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-foreground"
            >
              {labels.next} →
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ZoneButton({
  number,
  active,
  pressed,
  box,
  label,
  labelAt,
  onSelect,
  onHover,
  children,
}: {
  number: number;
  active: boolean;
  pressed: boolean;
  box: Box;
  label: string;
  labelAt: "top" | "bottom";
  onSelect: () => void;
  onHover: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-pressed={pressed}
      aria-label={label}
      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
      className={`absolute rounded-[0.4rem] border transition ${
        active
          ? "z-10 border-yellow bg-yellow/[0.08] shadow-[0_0_28px_rgba(245,230,66,0.25),inset_0_0_0_1px_rgba(245,230,66,0.45)]"
          : "border-yellow/55 bg-[#03040c] hover:border-yellow/90 hover:bg-yellow/[0.03]"
      }`}
    >
      {children}
      <span
        className={`absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap px-2 py-px font-mono text-[0.55rem] font-bold tracking-[0.12em] uppercase [clip-path:polygon(8%_0,92%_0,100%_50%,92%_100%,8%_100%,0_50%)] ${
          labelAt === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
        } ${active ? "bg-cyan text-black" : "bg-yellow text-black"}`}
      >
        {label}
      </span>
      <span
        className={`absolute -left-2 -top-2 z-20 inline-flex size-5 items-center justify-center rounded-full border font-mono text-[0.6rem] font-bold ${
          active ? "border-black bg-cyan text-black" : "border-cyan bg-background text-cyan"
        }`}
      >
        {number}
      </span>
    </button>
  );
}

function Die({ die, value, muted = false }: { die: string; value: number; muted?: boolean }) {
  return (
    <span
      className={`inline-flex h-[70%] aspect-square flex-col items-center justify-center rounded-sm border font-mono leading-none ${
        muted ? "border-line bg-panel-2 text-muted" : "border-yellow/70 bg-yellow/10 text-yellow"
      }`}
      title={die}
    >
      <span className="text-[0.7rem] font-bold">{value}</span>
      <span className="text-[0.4rem] opacity-70">{die}</span>
    </span>
  );
}

function Slot({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 items-center justify-center rounded-[0.3rem] border border-yellow/35">{children}</div>
  );
}

function MatCard({
  card,
  height,
  faceDown = false,
  spent = false,
}: {
  card: ExampleCard;
  height: string;
  faceDown?: boolean;
  spent?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[0.2rem] border border-line bg-black ${spent ? "rotate-90" : ""}`}
      style={{ height, aspectRatio: CARD_RATIO }}
      title={card.name}
    >
      {faceDown ? (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#1a2233_0%,#0a0c16_55%,#12182a_100%)] font-mono text-[0.5rem] tracking-[0.14em] text-cyan/70">
          €$
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imagePath} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
      )}
    </div>
  );
}
