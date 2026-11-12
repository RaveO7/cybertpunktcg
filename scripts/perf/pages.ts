// Pages mesurées par scripts/perf-audit.ts. Liste figée : changer une page casse la comparaison avec l'historique.
// `auth: true` : page mesurée connecté avec le compte de test (EMAIL_USER_TEST / EMAIL_PASSWORD_TEST).
export type PerfPage = { id: string; path: string; auth: boolean };

export const PERF_PAGES: PerfPage[] = [
  { id: "accueil", path: "/fr", auth: false },
  { id: "catalogue", path: "/fr/cartes", auth: false },
  { id: "fiche-carte", path: "/fr/cartes/adam-smasher-ender-of-legends", auth: false },
  { id: "connexion", path: "/fr/connexion", auth: false },
  { id: "cgu", path: "/fr/cgu", auth: false },
  { id: "accueil-connecte", path: "/fr", auth: true },
  { id: "tableau-de-bord", path: "/fr/tableau-de-bord", auth: true },
  { id: "collection", path: "/fr/cards", auth: true },
  { id: "decks", path: "/fr/decks", auth: true },
  { id: "investissement", path: "/fr/investissement", auth: true },
  { id: "tournois", path: "/fr/tournois", auth: true },
  { id: "parametres", path: "/fr/parametres", auth: true },
];
