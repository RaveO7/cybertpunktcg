"use client";

import { useSyncExternalStore } from "react";
import { countryOptions } from "./countries";

const noopSubscribe = () => () => {};

/**
 * Liste des pays d'un <select> rendu aussi côté serveur. Les noms viennent d'Intl.DisplayNames, dont
 * les données ICU diffèrent entre Node et les navigateurs (« South Korea » / « Korea ») : la liste
 * complète n'est construite qu'après l'hydratation. Avant, seul le pays choisi est proposé (sous son
 * code), pour que le rendu serveur et le premier rendu client soient identiques.
 */
export function useCountryOptions(locale: string, selected?: string) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (hydrated) return countryOptions(locale, selected ? [selected] : []);
  return selected ? [{ code: selected, name: selected }] : [];
}
