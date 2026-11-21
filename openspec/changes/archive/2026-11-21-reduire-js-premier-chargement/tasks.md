# Tasks

## 1. Mesure de référence

- [x] 1.1 Mesure prod « avant » : `npx tsx scripts/perf-audit.ts --only fiche-carte,collection,decks --runs 5 --label "avant chantier JS"`, lancée machine au calme juste avant la livraison. Vérification : un nouveau fichier dans `docs/perf/history/`.
- [x] 1.2 Script d'analyse du JS chargé par page, tiré du build avec source maps (dans le scratchpad, hors du dépôt), relancé à chaque étape. Vérification : il affiche les tailles de la fiche, de la collection et des decks.

## 2. Traductions précompilées (abandonné)

- [x] 2.1 Étudier `experimental.messages.precompile` de next-intl 4.14.9 : incompatible (alias `format-only` appliqué aussi au serveur, `t.raw` refusé, 140 contenus structurés en tableaux dans `landing`, `legal`, `rules`). Point abandonné, décision notée dans design.md.

## 3. Fenêtres et panneaux chargés à l'ouverture

- [x] 3.1 Collection : `CardModal` (avec `WishlistPanel`) et `QuickAddSheet` importés avec `next/dynamic`, avec un état de chargement (`OverlaySkeleton`), puis préchargés au repos après `load` (`usePreloadAfterLoad`, panneau des prix compris) pour rester disponibles hors ligne. Vérification : absents du JS initial de `/fr/cards` (855 → 812 Ko) ; e2e collection (dont le lien direct `?printing=`) et hors ligne (fiche jamais ouverte, réseau coupé) verts.
- [x] 3.2 Decks : `DeckEditor` et ses panneaux importés à l'ouverture d'un deck, préchargés au repos. Vérification : absents du JS initial de `/fr/decks` (828 → 765 Ko) ; e2e des decks verts.
- [x] 3.3 Header : écarté. Le choix de langue est affiché en permanence et seule sa liste s'ouvre au clic (< 3 Ko) ; les erreurs de synchronisation pèsent moins de 1 Ko.

## 4. Code commun allégé

- [x] 4.1 Modules communs passés en revue : rien à différer sans risque. `push-client` (1,9 Ko), essayé en import à la déconnexion, est laissé en place, car un fichier indisponible ferait échouer la déconnexion. `offline-queue` (file appliquée dès le chargement de la collection), `i18n/match` (liens localisés) et `CollectionProvider` servent au premier affichage et restent en place. Vérification : tests unitaires de la zone verts ; e2e session verts.

## 5. Requêtes de démarrage sans session mémorisée

- [x] 5.1 Proxy : poser ou retirer le cookie indicateur `cptcg_signed` selon la présence de `cptcg_session`, seulement quand son état change. Vérification : `tests/unit/proxy.test.ts` (pose, suppression, aucun `Set-Cookie` si inchangé).
- [x] 5.2 `BOOT_REQUESTS_SCRIPT` : lancer collection et catalogue aussi quand l'indicateur est présent. Vérification : `tests/unit/boot-requests.test.ts` (indicateur seul, rien, faux positif) ; e2e `session.spec.ts` « cookie de session sans session mémorisée ».
- [x] 5.3 Session expirée avec indicateur présent : l'écran de connexion s'affiche. Vérification : e2e existant « une session supprimée en base renvoie à l'écran de connexion » vert (l'indicateur y est posé dès le premier chargement).

## 6. Vérification d'ensemble

- [x] 6.1 `npm run verify` vert (hook) ; captures desktop et mobile de `fr/cards`, `fr/decks` et de la fiche carte, relues.
- [x] 6.2 Mesure prod « après » avec les mêmes options que la 1.1, à la suite ; résultats et conclusion ajoutés à `docs/recherches/2026-11-15-lcp-mobile-pages-cartes.md`. Vérification : tableau avant/après dans la recherche.

## Workflow follow-up

- Relecture indépendante (agent `relecteur`), archivage du change, commits, livraison en circuit `complet`.
