# Proposal

## Why

Les tournois de Cyberpunk TCG (soirées en boutique, Night City Brawl, Showdown) se gèrent aujourd'hui sur papier ou avec Melee.gg, sans lien avec l'app où les joueurs ont déjà leur collection et leurs decks. Un organisateur (TO) doit pouvoir lancer un tournoi depuis son téléphone, que **personne, une partie ou tous** les joueurs aient l'app, sans qu'un cas imprévu (doublon, désaccord, Wi-Fi coupé, drop, égalité au cut…) ne bloque le tournoi en cours.

## What Changes

- **Tournoi** : création par un compte (le TO), format Boutique (3 rondes fixes) ou Compétitif (rondes suisses selon l'effectif), Bo1 ou Bo3, durée de ronde, taille du top cut (auto, fixe ou aucun). Co-organisateurs. Cycle de vie : inscriptions → rondes suisses → top cut → terminé (ou annulé).
- **Inscription unifiée** : un seul type de joueur (`TournamentPlayer`) qui entre de trois façons — code à 6 caractères / QR code du tournoi (compte ou invité), joueur « papier » créé par le TO, ou récupération d'un joueur papier via son QR personnel. Fusion de doublons, pseudos uniques par tournoi, approbation optionnelle, fermeture des inscriptions, arrivée en retard, retrait avant la ronde 1.
- **Appariements** : système suisse (ronde 1 aléatoire, puis par points sans revanche), bye au moins bien classé sans bye, revanche autorisée en dernier recours, échange manuel et ré-appariement avant démarrage de la ronde, no-show en un clic.
- **Saisie des résultats** : mode choisi automatiquement par match (deux joueurs équipés → déclaration + confirmation ; un seul → confirmation sur le même téléphone, validée directement ou par le TO selon un réglage ; aucun → TO). États `en cours → déclaré → validé`, plus `contesté`. Le TO peut tout saisir ou corriger ; un TO-joueur ne valide pas son propre match. Scores Bo3/Bo1, nul, double défaite, ID. Expiration des déclarations non confirmées.
- **Classement** : 3/1/0, tie-breakers OMW% → GW% → OGW% (plancher 33 %, byes exclus de l'OMW, joueurs droppés conservés), recalcul à chaque correction.
- **Top cut** : élimination directe classée (1-8, 2-7…), départage au seuil par tie-breakers puis tirage visible, remplacement d'un qualifié qui décline.
- **Drops / DQ** : drop par le joueur ou le TO, effet à la ronde suivante, réintégration, DQ visible.
- **Chrono de ronde** : horloge serveur, pause/reprise, ajout de temps global ou par table.
- **Robustesse** : tout l'état est côté serveur ; les actions du TO sont mises en file hors connexion et renvoyées, avec indicateur « non synchronisé » ; écrans rafraîchis automatiquement.
- **Données** : un joueur reste dans le tournoi même si son compte est supprimé (lien `SetNull` + pseudo copié). **Pas de cascade depuis `User` vers les résultats.**
- Nouvel onglet « Tournois » dans la navigation, pages publiques par code (`/t/<code>`), textes dans les 5 langues de l'app (FR, EN, DE, ES, IT).

## Capabilities

### New Capabilities
- `tournaments/lifecycle`: création et réglages d'un tournoi, rôles (TO, co-organisateurs), cycle de vie et transitions d'état, ouverture/fermeture des inscriptions, annulation, résilience (état serveur, file hors connexion du TO).
- `tournaments/registration`: entrée des joueurs (code/QR, invité, compte, joueur papier), QR personnel et récupération de profil, fusion de doublons, unicité des pseudos, approbation, retard, retrait, drop, réintégration, DQ, conservation après suppression de compte.
- `tournaments/pairing`: appariements suisses, byes, revanches en dernier recours, corrections manuelles avant démarrage, nombre de rondes, sélection et arbre du top cut.
- `tournaments/match-reporting`: formats de score, mode de saisie par match, déclaration/confirmation/contestation, pouvoirs du TO, no-show, expiration, clôture de ronde, corrections après coup.
- `tournaments/standings`: points de match, tie-breakers, ordre du classement, départage au seuil du top cut.
- `tournaments/round-clock`: chrono de ronde côté serveur, pause, ajout de temps global et par table.

### Modified Capabilities
_Aucune : aucune spec n'existe encore dans `openspec/specs/`._

## Impact

- **Base** : nouveaux modèles Prisma (`Tournament`, `TournamentOrganizer`, `TournamentPlayer`, `TournamentRound`, `TournamentMatch`, `TournamentAction`) dans `prisma/schema.prisma` (le schéma SQLite est régénéré par `scripts/prisma.mjs`). Relation optionnelle `User → TournamentPlayer` en `SetNull`, `User → Tournament` (TO) à définir sans perte de résultats.
- **API** : nouvelles routes sous `src/app/api/tournaments/…` (même style que `api/wishlist` : `requireUser`, `readJsonBody` + schémas zod dans `src/lib/api-schemas.ts`), limitation de débit (`src/lib/rate-limit.ts`) sur la saisie du code et l'inscription invité.
- **Logique** : nouveau module pur `src/lib/tournament/` (appariement, classement, top cut, machine d'états des matchs) testé en `tests/unit`, et accès base testé en `tests/db` sur base SQLite avec nettoyage en `finally`.
- **UI** : pages `/tournois`, `/tournois/[id]` (vue TO), `/t/[code]` (vue joueur), lien dans `Header.tsx`, textes dans `src/lib/i18n/messages.ts`.
- **Dépendance** : une bibliothèque de génération de QR code (ex. `qrcode`). Le scan se fait avec l'appareil photo du téléphone (le QR contient une URL), pas de scanner intégré.
- **Session invité** : nouveau cookie httpOnly propre au joueur invité, distinct de la session de compte.
