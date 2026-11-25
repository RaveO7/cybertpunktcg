import { useSyncExternalStore } from "react";

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

export function useCompact() {
  return useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
}
