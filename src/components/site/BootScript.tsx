"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Script inline exécuté avant le premier affichage (thème…). Rendu seulement dans le HTML du serveur :
 * un <script> créé par React côté client ne s'exécute jamais (et React le signale, ex. page 404 rendue
 * entièrement côté client en dev). Après l'hydratation il est retiré, il a déjà servi.
 */
export function BootScript({ html }: { html: string }) {
  const fromServer = useSyncExternalStore(subscribe, () => false, () => true);
  return fromServer ? <script dangerouslySetInnerHTML={{ __html: html }} /> : null;
}
