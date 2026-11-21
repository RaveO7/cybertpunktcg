# Proposal

## Why

La note Lighthouse mobile des pages à cartes reste sous 92 (prod du 21/11 : fiche carte 89, decks 88, collection 71). Le diagnostic du 15/11 (`docs/recherches/2026-11-15-lcp-mobile-pages-cartes.md`) montre que le LCP simulé suit le volume chargé au début. Sur ce volume, le levier le plus net est le JavaScript : −30 % de JS donne −300 ms de LCP sur la fiche.

Le JS chargé au premier affichage pèse ~600 Ko non compressés sur la fiche, ~745 Ko sur la collection et ~720 Ko sur les decks. Environ 430 Ko viennent de React et de Next et ne peuvent pas être réduits. Le reste vient du projet :
- le moteur de traduction (~45 Ko) ;
- le code commun à toutes les pages ;
- les fenêtres et panneaux chargés dès l'arrivée alors qu'ils ne s'ouvrent qu'au clic.

Sur la collection, le LCP (5,3 s) attend en plus le catalogue et la collection. Ces deux requêtes ne partent qu'après le JS quand l'appareil n'a pas de session mémorisée. C'est le cas pendant la mesure Lighthouse, après effacement des données du site, et sur Safari après 7 jours sans visite.

## What Changes

- Les fenêtres et panneaux qui ne s'affichent qu'après une action sont chargés à leur ouverture, pas au premier chargement :
  - collection : fiche de carte en fenêtre, ajout rapide, liste de souhaits ;
  - decks : éditeur et panneaux.
- Le code commun à toutes les pages est allégé : le code qui ne sert qu'à un compte connecté ou à un écran particulier ne part plus avec chaque page.
- Sur les pages privées, la collection et le catalogue partent dès le `<head>` quand le navigateur a un cookie de session. Il n'y a plus besoin de la session mémorisée sur l'appareil pour cela. Un cookie lisible et sans secret signale la présence de la session.
- La performance est mesurée en prod avant et après, avec `perf-prod --only fiche-carte,collection,decks --runs 5`.

## Capabilities

### New Capabilities
- `site/first-load` : ce que le navigateur charge et lance au premier affichage d'une page. Couvre le JS différé jusqu'à l'usage et les requêtes de démarrage des pages privées.

### Modified Capabilities
(aucune)

## Impact

- Fichiers modifiés :
  - `next.config.ts` : option de next-intl ;
  - `src/i18n/` : chargement des messages ;
  - `src/proxy.ts` : cookie indicateur de session ;
  - `src/lib/boot-requests.ts` : script de démarrage ;
  - `src/components/CardsExplorer.tsx`, `src/components/DecksScreen.tsx` et les composants communs de `SiteShell` : imports différés.
- Aucun changement de schéma, d'API ni de dépendance.
- Comportement visible inchangé. À l'ouverture d'une fenêtre pour la première fois, un court état de chargement peut apparaître si le réseau est lent.
