import type { BoardCard, MatchState } from "@/lib/rules/demo-match";

/*
 * Déplacements de cartes du tutoriel (technique FLIP).
 * Avant l'action on photographie chaque élément [data-flip] (position + copie du DOM) ;
 * après le rendu, une carte « fantôme » vole de l'ancienne zone vers la nouvelle
 * (main → Eddies / Trash / Field, Field → Trash, Deck → main) et les cartes restées
 * dans leur zone glissent vers leur nouvelle place.
 *
 * Clés data-flip : hand:<ref>, field:<id>, field:pending, rival:<id>, eddie:<id>, trash, deck.
 */

export type FlipSnapshot = {
  prev: MatchState;
  rects: Map<string, DOMRect>;
  nodes: Map<string, HTMLElement>;
};

type Flight = {
  from: DOMRect;
  to: DOMRect;
  face: HTMLElement;
  dest: HTMLElement;
  /** Retournement en vol : vers le dos (vente → Eddie) ou vers la face (pioche). */
  turn?: "to-back" | "to-front";
};

const FLY_MS = 640;
const STAGGER_MS = 120;
const SLIDE_MS = 380;
const EASE = "cubic-bezier(0.45, 0, 0.2, 1)";
const ENTRY_ANIMATIONS = /^dm-(deal|drop|flip)-in$/;

export function takeFlipSnapshot(root: HTMLElement, prev: MatchState): FlipSnapshot {
  const rects = new Map<string, DOMRect>();
  const nodes = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
    const key = el.dataset.flip!;
    rects.set(key, el.getBoundingClientRect());
    nodes.set(key, el.cloneNode(true) as HTMLElement);
  });
  return { prev, rects, nodes };
}

function added(next: BoardCard[], prev: BoardCard[]) {
  return next.filter((c) => !prev.some((p) => p.id === c.id));
}

export function playCardMoves(root: HTMLElement, snap: FlipSnapshot, next: MatchState) {
  const { prev, rects, nodes } = snap;
  const find = (key: string) => root.querySelector<HTMLElement>(`[data-flip="${CSS.escape(key)}"]`);
  const flights: Flight[] = [];
  const landing = new Set<string>();
  // Même carte, clé différente avant / après (carte payée qui se pose sur le Field).
  const aliases = new Map<string, string>();

  const fly = (
    fromKey: string,
    toKey: string,
    opts: { turn?: Flight["turn"]; face?: HTMLElement; equip?: boolean } = {},
  ) => {
    const from = rects.get(fromKey);
    // Gear : il vise sa place sur l'Unit équipée, l'Unit reste visible.
    const dest = opts.equip ? find(toKey)?.querySelector<HTMLElement>("[data-equipped]") : find(toKey);
    const face = opts.face ?? nodes.get(fromKey);
    if (!from || !dest || !face) return;
    landing.add(toKey);
    flights.push({ from, to: dest.getBoundingClientRect(), face, dest, turn: opts.turn });
  };

  const trashGrew = next.trash.length > prev.trash.length;
  const newEddies = added(next.eddies, prev.eddies);

  // Main → Eddies (vente), Field (paiement en cours) ou Trash.
  for (const ref of prev.hand) {
    if (next.hand.includes(ref)) continue;
    const eddie = newEddies.find((c) => c.ref === ref);
    if (eddie) fly(`hand:${ref}`, `eddie:${eddie.id}`, { turn: "to-back" });
    else if (next.pendingPlay === ref) fly(`hand:${ref}`, "field:pending");
    else if (trashGrew && next.trash[next.trash.length - 1] === ref) fly(`hand:${ref}`, "trash");
  }

  // Paiement terminé : l'Unit se pose, le Gear rejoint l'Unit qu'il équipe.
  if (prev.pendingPlay && !next.pendingPlay) {
    const unit = added(next.field, prev.field).find((c) => c.ref === prev.pendingPlay);
    const host = next.field.find(
      (c) => c.equipped === prev.pendingPlay && prev.field.find((p) => p.id === c.id)?.equipped !== c.equipped,
    );
    if (unit) aliases.set(`field:${unit.id}`, "field:pending");
    else if (host) fly("field:pending", `field:${host.id}`, { equip: true });
  }

  // Field (le tien ou celui du Rival) → Trash.
  if (trashGrew) {
    for (const [zone, list, nextList] of [
      ["field", prev.field, next.field],
      ["rival", prev.rivalField, next.rivalField],
    ] as const) {
      for (const c of list) {
        if (!nextList.some((n) => n.id === c.id)) fly(`${zone}:${c.id}`, "trash");
      }
    }
  }

  // Pioche : Deck → main, la carte se retourne en vol.
  for (const ref of next.hand) {
    if (prev.hand.includes(ref)) continue;
    const face = find(`hand:${ref}`)?.cloneNode(true) as HTMLElement | undefined;
    fly("deck", `hand:${ref}`, { turn: "to-front", face });
  }

  // Cartes restées en place : elles glissent vers leur nouvelle position.
  root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
    const key = el.dataset.flip!;
    if (landing.has(key)) return;
    const old = rects.get(aliases.get(key) ?? key);
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left + old.width / 2 - (now.left + now.width / 2);
    const dy = old.top + old.height / 2 - (now.top + now.height / 2);
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return;
    el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }], { duration: SLIDE_MS, easing: EASE });
  });

  flights.forEach((f, i) => launch(f, i * STAGGER_MS));
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function cardBack() {
  const back = document.createElement("div");
  back.className =
    "aspect-card flex items-center justify-center border border-line bg-[linear-gradient(145deg,#243049_0%,#0a0c16_55%,#152033_100%)] shadow-lg";
  back.innerHTML = '<span class="font-mono text-[0.65rem] tracking-[0.16em] text-cyan/80">€$</span>';
  return back;
}

function launch({ from, to, face, dest, turn }: Flight, delay: number) {
  // Le fantôme est rendu à la plus grande des deux tailles (net), puis réduit par transform.
  const base = from.width >= to.width ? from : to;
  const width = base.width;
  const height = width * 1.4;
  const origin = center(base);
  const a = center(from);
  const b = center(to);
  const s0 = from.width / width;
  const s1 = to.width / width;
  const lift = Math.min(70, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
  const at = (p: { x: number; y: number }, s: number, extra = "") =>
    `translate(${p.x - origin.x}px, ${p.y - origin.y}px) scale(${s})${extra}`;

  const ghost = document.createElement("div");
  ghost.className = "dm-ghost";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    left: `${origin.x - width / 2}px`,
    top: `${origin.y - height / 2}px`,
    width: `${width}px`,
    transform: at(a, s0),
  });

  const card = document.createElement("div");
  card.className = "dm-ghost__card";
  const front = document.createElement("div");
  front.className = "dm-ghost__face";
  front.append(face);
  card.append(front);
  if (turn) {
    const back = document.createElement("div");
    back.className = "dm-ghost__back";
    back.append(cardBack());
    card.append(back);
  }
  ghost.append(card);
  document.body.append(ghost);

  // La carte d'arrivée reste cachée pendant le vol ; son animation d'entrée est déjà jouée.
  dest.getAnimations({ subtree: true }).forEach((anim) => {
    if (anim instanceof CSSAnimation && ENTRY_ANIMATIONS.test(anim.animationName)) anim.finish();
  });
  dest.animate([{ opacity: 0 }, { opacity: 0 }], { duration: delay + FLY_MS });

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
  const flight = ghost.animate(
    [
      { transform: at(a, s0), filter: "drop-shadow(0 0 0 rgba(62, 224, 255, 0))" },
      {
        transform: at(mid, Math.max(s0, s1) * 1.12, " rotate(-4deg)"),
        filter: "drop-shadow(0 14px 22px rgba(62, 224, 255, 0.55))",
        offset: 0.5,
      },
      { transform: at(b, s1), filter: "drop-shadow(0 0 0 rgba(62, 224, 255, 0))" },
    ],
    { duration: FLY_MS, delay, easing: EASE, fill: "both" },
  );
  if (turn) {
    const [r0, r1] = turn === "to-back" ? [0, 180] : [180, 0];
    card.animate([{ transform: `rotateY(${r0}deg)` }, { transform: `rotateY(${r1}deg)` }], {
      duration: FLY_MS * 0.7,
      delay: delay + FLY_MS * 0.15,
      easing: "ease-in-out",
      fill: "both",
    });
  }
  flight.onfinish = () => {
    ghost.remove();
    dest.animate(
      [
        { scale: "1.12", filter: "brightness(1.7)" },
        { scale: "1", filter: "none" },
      ],
      { duration: 280, easing: "ease-out" },
    );
  };
  flight.oncancel = () => ghost.remove();
}
