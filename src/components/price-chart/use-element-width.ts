import { useEffect, useState } from "react";

/** Largeur de l'élément. Reçoit l'élément (ref callback) : le conteneur n'existe pas tant que
 *  la courbe est vide, la mesure doit démarrer quand il apparaît. */
export function useElementWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return;
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
