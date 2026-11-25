"use client";

import { useEffect, useState } from "react";

/** Vrai quand un champ texte a le focus sur écran tactile, donc que le clavier virtuel est ouvert. */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const isField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
      if (target.tagName !== "INPUT") return false;
      const type = (target as HTMLInputElement).type;
      return !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(type);
    };
    // Barre réaffichée avec un léger délai : un appui sur un bouton retire le focus du champ avant le
    // clic, et une barre revenue tout de suite sous le doigt recevrait ce clic à la place du bouton.
    let closeTimer: number | undefined;
    // Focus sur un bouton (donné dès l'appui sur Chrome) : la fermeture reste au minuteur du focusout.
    const onFocusIn = (event: FocusEvent) => {
      if (!isField(event.target)) return;
      window.clearTimeout(closeTimer);
      setOpen(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (isField(event.relatedTarget)) return;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => setOpen(false), 300);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.clearTimeout(closeTimer);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return open;
}
