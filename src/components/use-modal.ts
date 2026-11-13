"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Comportement commun des fenêtres modales et des feuilles : focus initial, Tab et Maj+Tab bouclent
 * dans la fenêtre, arrière-plan inerte, page bloquée, Échap ferme la plus haute des fenêtres
 * ouvertes, et le focus revient à l'élément qui l'a ouverte.
 *
 * `ref` désigne l'élément qui contient toute la fenêtre (son voile compris s'il est à côté d'elle) :
 * tout ce qui est en dehors devient inerte.
 */
export function useModal(
  ref: RefObject<HTMLElement | null>,
  {
    open = true,
    onClose,
    initialFocus,
    closeOnEscape = true,
    lockScroll = true,
  }: {
    open?: boolean;
    onClose: () => void;
    /** Élément à focaliser à l'ouverture ; sinon le premier élément focalisable de la fenêtre. */
    initialFocus?: RefObject<HTMLElement | null>;
    /** false pendant un enregistrement en cours : Échap ne ferme pas. */
    closeOnEscape?: boolean;
    lockScroll?: boolean;
  },
) {
  const onCloseRef = useRef(onClose);
  const escapeRef = useRef(closeOnEscape);
  useEffect(() => {
    onCloseRef.current = onClose;
    escapeRef.current = closeOnEscape;
  });

  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const entry = { root };
    // Élément d'origine : celui qui a le focus, sauf s'il est dans la fenêtre (second montage du mode
    // strict) ou s'il a disparu (fenêtre remontée) ; sinon le dernier focalisé hors des fenêtres.
    const active = document.activeElement;
    const previous =
      active instanceof HTMLElement && active !== document.body && !root.contains(active) ? active : lastOutsideFocus;
    stack.push(entry);
    const restoreInert = makeBackgroundInert(root);
    const unlockScroll = lockScroll ? lockPageScroll() : () => undefined;

    const target = initialFocus?.current ?? focusableIn(root)[0];
    if (target) target.focus({ preventScroll: true });
    else {
      if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      root.focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== entry || !root) return;
      if (event.key === "Escape") {
        if (event.defaultPrevented || !escapeRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableIn(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && root.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      restoreInert();
      unlockScroll();
      // Après la levée de `inert` : un élément inerte ne peut pas recevoir le focus.
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ouverture et fermeture seulement
  }, [open, ref, lockScroll]);
}

/** Une fenêtre modale est ouverte : les raccourcis de la page (Échap compris) doivent s'effacer. */
export function isModalOpen() {
  return stack.length > 0;
}

/** Fenêtres ouvertes, de la plus ancienne à la plus haute. */
const stack: { root: HTMLElement }[] = [];

/** Dernier élément focalisé en dehors de toute fenêtre : celui qui a ouvert la fenêtre courante. */
let lastOutsideFocus: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && !stack.some((entry) => entry.root.contains(target))) lastOutsideFocus = target;
    },
    true,
  );
}

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

function focusableIn(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      // Masqué (display: none, version téléphone ou bureau d'un même formulaire) : pas de boîte.
      element.getClientRects().length > 0,
  );
}

/** Nombre de fenêtres qui rendent chaque élément inerte (fenêtres empilées). */
const inertCount = new Map<Element, number>();

/** Éléments laissés actifs sous une fenêtre (barre de navigation du bas). */
const KEEP = "[data-modal-keep]";

/**
 * Rend inerte tout ce qui n'est ni la fenêtre ni l'un de ses ancêtres (portail ou non), sauf les
 * éléments `data-modal-keep` : un bloc qui en contient un est parcouru pour n'inerter que le reste.
 */
function makeBackgroundInert(root: HTMLElement) {
  const touched: Element[] = [];
  const makeInert = (element: Element) => {
    if (element.tagName === "SCRIPT" || element.tagName === "STYLE" || element.matches(KEEP)) return;
    if (element.querySelector(KEEP)) {
      for (const child of Array.from(element.children)) makeInert(child);
      return;
    }
    const count = inertCount.get(element) ?? 0;
    // Déjà inerte sans nous (contenu masqué de la page) : on n'y touche pas.
    if (count === 0 && element.hasAttribute("inert")) return;
    inertCount.set(element, count + 1);
    if (count === 0) element.setAttribute("inert", "");
    touched.push(element);
  };
  let node: HTMLElement | null = root;
  while (node && node !== document.body && node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling !== node) makeInert(sibling);
    }
    node = node.parentElement;
  }
  return () => {
    for (const element of touched) {
      const count = (inertCount.get(element) ?? 1) - 1;
      if (count > 0) {
        inertCount.set(element, count);
        continue;
      }
      inertCount.delete(element);
      element.removeAttribute("inert");
    }
  };
}

let scrollLocks = 0;
let restoreScroll: (() => void) | null = null;

/**
 * Bloque le défilement de la page et de la zone de l'application (`<main>`, qui défile à la place
 * de la page), avec une marge à droite de la largeur de la barre disparue : rien ne se décale.
 */
function lockPageScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    const targets: HTMLElement[] = [document.documentElement];
    const main = document.querySelector("main");
    if (main instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(main).overflowY)) targets.push(main);
    const saved = targets.map((element) => {
      const bar =
        element === document.documentElement
          ? window.innerWidth - document.documentElement.clientWidth
          : element.offsetWidth - element.clientWidth;
      const style = { overflow: element.style.overflow, paddingRight: element.style.paddingRight };
      if (bar > 0) {
        const padding = parseFloat(getComputedStyle(element).paddingRight) || 0;
        element.style.paddingRight = `${padding + bar}px`;
      }
      element.style.overflow = "hidden";
      return { element, style };
    });
    restoreScroll = () => {
      for (const { element, style } of saved) {
        element.style.overflow = style.overflow;
        element.style.paddingRight = style.paddingRight;
      }
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      restoreScroll?.();
      restoreScroll = null;
    }
  };
}
