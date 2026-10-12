// Un balayage dans une zone défilant horizontalement (schéma du tapis, tableaux…) ou marquée
// `data-no-swipe` (courbe de prix…) ne doit pas déclencher de navigation.
export function isInHorizontalScroller(target: Element): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.hasAttribute("data-no-swipe")) return true;
    if (el.scrollWidth > el.clientWidth) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}
