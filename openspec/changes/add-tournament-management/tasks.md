# Tasks

## 1. Modèle de données

- [x] 1.1 Ajouter dans `prisma/schema.prisma` les modèles `Tournament`, `TournamentOrganizer`, `TournamentInvite`, `TournamentPlayer`, `TournamentRound`, `TournamentMatch`, `TournamentMatchLog`, `TournamentAction` (champs `String` pour les états, pas d'enum ni de `Json`), avec les relations inverses sur `User` (`TournamentPlayer.userId` en `SetNull`, `TournamentOrganizer.userId` en `Cascade`, aucune relation `Tournament → User`). Vérifier que `node scripts/prisma.mjs validate` et `node scripts/prisma.mjs db push` passent sur la base SQLite locale
- [x] 1.2 Ajouter la dépendance `qrcode` (et ses types) et vérifier que `npm run typecheck` passe

## 2. Logique pure : codes, scores et états de match

- [x] 2.1 Créer `src/lib/tournament/code.ts` (code à 6 caractères sans ambiguïté, normalisation de saisie, `nameKey` sans casse, accents ni espaces superflus) ; vérifier avec `tests/unit/tournament-code.test.ts` (alphabet, `k7mq2x` → `K7MQ2X`, « Lúcas » ≡ « lucas »)
- [x] 2.2 Créer `src/lib/tournament/scores.ts` (scores bo1/bo3 autorisés, interdits en top cut, gagnant, points, ID, double défaite) ; vérifier avec `tests/unit/tournament-scores.test.ts` couvrant chaque scénario de « Scores autorisés », « Résultats spéciaux » et « Pas de nul en top cut »
- [x] 2.3 Créer `src/lib/tournament/match-state.ts` (déclarer, modifier sa déclaration, confirmer, refuser, déclarations concurrentes identiques ou différentes, confirmation sur place selon `oneDeviceMode`, saisie organisateur, organisateur-joueur, no-show, annulation, « en attente trop longue ») ; vérifier avec `tests/unit/tournament-match-state.test.ts` reprenant les scénarios de `specs/tournaments/match-reporting`

## 3. Logique pure : classement

- [x] 3.1 Créer `src/lib/tournament/standings.ts` (points, MW%, GW%, OMW%, OGW% avec plancher 33 %, bye exclu, droppés conservés, rondes manquées en mode « défaite », tri, égalités, classement final avec top cut) ; vérifier avec `tests/unit/tournament-standings.test.ts` reprenant les exemples chiffrés de la spec (7 pts, GW% 80 %, OMW% ≈ 49,8 %, adversaire droppé à 50 %)

## 4. Logique pure : appariements et top cut

- [x] 4.1 Porter l'algorithme d'appariement de poids maximal d'Edmonds dans `src/lib/tournament/blossom.ts` ; vérifier avec `tests/unit/tournament-blossom.test.ts` qui compare à une force brute sur des centaines de graphes aléatoires (N ≤ 10)
- [x] 4.2 Créer `src/lib/tournament/pairing.ts` (nombre de rondes, ronde 1 aléatoire avec générateur injectable, choix du bye, poids revanche/écart de points/écart de rang, exclusions, échange de deux joueurs, déplacement du bye, signalement des revanches et seconds byes) ; vérifier avec `tests/unit/tournament-pairing.test.ts` (pas de revanche quand c'est possible, groupe impair qui descend, 4 joueurs en 4e ronde, 7 joueurs avec bye, simulation complète de tournois de 3 à 64 joueurs sans plantage)
- [x] 4.3 Créer `src/lib/tournament/top-cut.ts` (taille auto et repli sur la puissance de 2 inférieure, sélection avec tirage stocké en cas d'égalité, remplacement d'un qualifié qui décline, arbre 1–8/4–5/2–7/3–6, tour suivant, propagation d'une correction tant que le tour suivant n'a pas démarré) ; vérifier avec `tests/unit/tournament-top-cut.test.ts`
- [x] 4.4 Créer `src/lib/tournament/clock.ts` (temps restant à partir de l'heure serveur, pauses, ajouts, temps de table, plancher à zéro, durée du top cut) ; vérifier avec `tests/unit/tournament-clock.test.ts` reprenant les scénarios de `specs/tournaments/round-clock`

## 5. Accès base et commandes organisateur

- [x] 5.1 Créer `src/lib/tournament/repository.ts` : chargement d'un tournoi complet, transaction d'écriture qui incrémente `revision`, verrou optimiste par `revision` du tournoi (5 essais), `version` de match incrémentée, journal `TournamentMatchLog`, promotion du co-organisateur le plus ancien quand il n'y a plus d'owner ; vérifier avec `tests/db/tournament-repository.test.ts` (sur SQLite, nettoyage des `Tournament` et `User` `@example.com` dans un `finally`)
- [x] 5.2 Ajouter dans `src/lib/api-schemas.ts` les schémas zod de création, de réglages, de l'union discriminée des commandes organisateur et des commandes joueur ; vérifier avec des cas ajoutés à `tests/unit/api-schemas.test.ts` (types inconnus, durée hors de 10 à 180 minutes, taille de top cut invalide)
- [x] 5.3 Créer `src/lib/tournament/commands.ts`, qui exécute chaque commande organisateur (réglages modifiables selon l'état, code, inscriptions, joueurs, fusion, QR personnel, drop, réintégration, DQ, rondes, échanges, chrono, résultats avec 409 en cas de conflit, no-show, clôture, déclin au top cut, invitations, annulation), avec l'idempotence par `TournamentAction` ; vérifier avec `tests/db/tournament-commands.test.ts` (même `clientActionId` envoyé deux fois → un seul effet, conflit → 409, droits owner/co-organisateur)
- [x] 5.4 Créer les routes `src/app/api/tournaments/route.ts` (GET mes tournois, POST création), `[id]/route.ts`, `[id]/actions/route.ts`, `[id]/state/route.ts` (vue TO ou joueur, `unchanged` si la révision n'a pas changé, `serverNow`) et `invite/[token]/route.ts`, après relecture des guides route handlers dans `node_modules/next/dist/docs/` ; vérifier avec `tests/db/tournament-routes.test.ts` (401 sans compte, 403 pour un non-organisateur, brouillon invisible pour un joueur)

## 6. Inscription et commandes joueur

- [x] 6.1 Créer `src/lib/tournament/player-auth.ts` (jeton d'appareil haché dans le cookie `cptcg_tp_<id>`, identification par compte ou par appareil, QR personnel à usage unique valable 15 min, remplacement de l'ancien appareil) ; vérifier avec `tests/db/tournament-player-auth.test.ts`
- [x] 6.2 Créer les routes `src/app/api/t/[code]/route.ts`, `src/app/api/t/[code]/join/route.ts` (compte ou invité, pseudo unique, pseudo proche d'un joueur papier, approbation, inscriptions fermées, arrivée en retard, limite de 20 essais par minute et par IP) et `src/app/api/t/claim/route.ts` ; vérifier avec `tests/db/tournament-join.test.ts` couvrant chaque scénario de `specs/tournaments/registration`
- [x] 6.3 Créer `src/app/api/tournaments/[id]/player/route.ts` (déclarer, confirmer, refuser, confirmer sur place, drop, désinscription avant la ronde 1), avec un 403 pour qui n'est pas joueur du match ; vérifier avec `tests/db/tournament-player-commands.test.ts`, y compris deux déclarations concurrentes différentes → `conteste`

## 7. Scénario de bout en bout côté serveur

- [x] 7.1 Écrire `tests/db/tournament-flow.test.ts` : un tournoi compétitif de 10 joueurs mêlant joueurs papier, invités et comptes, avec un retardataire, un drop, une DQ, une fusion de doublon, une contestation tranchée, une correction après coup, une égalité au seuil du top 4 départagée par tirage, un qualifié qui décline, puis le top cut jusqu'au champion ; vérifier que le test passe et ne laisse aucune ligne en base (comptage avant/après dans un `finally`)

## 8. Interface organisateur

- [x] 8.1 Ajouter les textes des tournois dans `src/lib/i18n/messages.ts` pour les 5 langues de l'app (FR, EN, DE, ES, IT) ; vérifier que `tests/unit/i18n.test.ts` passe (mêmes clés, arité, aucune chaîne vide ni restée en français)
- [x] 8.2 Créer le hook client de sondage (5 s quand la page est visible, révision, calcul du décalage d'horloge) et `src/lib/tournament/offline-queue.ts` (file `localStorage` protégée par try/catch, renvoi ordonné, conflits) ; vérifier avec `tests/unit/tournament-offline-queue.test.ts` (ordre, arrêt sur erreur réseau, retrait sur 4xx, `localStorage` indisponible)
- [x] 8.3 Créer la page `/tournois` (mes tournois organisés et joués, formulaire de création) ; vérifier dans l'app lancée qu'un compte crée un tournoi et le voit dans la liste
- [x] 8.4 Créer la console `/tournois/[id]` : onglet Joueurs (ajout papier, QR du tournoi et QR personnel, approbation, fusion, renommage, drop, réintégration, DQ) ; vérifier dans l'app lancée sur une largeur de téléphone
- [x] 8.5 Console, onglet Ronde (brouillon, échange, déplacement du bye, publication, démarrage, chrono avec pause/ajout/temps de table, liste des matchs triée par urgence, saisie rapide des scores, no-show, clôture, indicateur « non synchronisé ») ; vérifier dans l'app lancée en coupant le réseau (DevTools hors ligne) pendant la saisie de trois résultats, puis en le rétablissant
- [x] 8.6 Console, onglets Classement (tie-breakers affichés, mentions drop/DQ/tirage, avertissement de correction) et Réglages (champs figés après démarrage, co-organisateurs, annulation) ; vérifier dans l'app lancée

## 9. Interface joueur

- [x] 9.1 Créer `/t/[code]` : inscription (compte ou invité, messages pour pseudo pris ou proche d'un joueur papier, attente d'approbation), puis vue joueur (ma table, mon adversaire, chrono, appariements publiés, classement, drop) ; vérifier dans l'app lancée avec deux navigateurs (un compte, un invité)
- [x] 9.2 Ajouter la déclaration et la confirmation du score (les deux joueurs équipés, ou un seul avec le bouton « Je confirme, je suis X »), la modification avant confirmation et l'affichage « contesté » ; vérifier dans l'app lancée pour les deux modes de `oneDeviceMode`
- [x] 9.3 Créer `/t/claim/[token]` (récupération de profil, QR expiré ou déjà utilisé) ; vérifier dans l'app lancée qu'un joueur papier récupère son historique et que l'ancien appareil perd l'accès

## 10. Mise en service

- [x] 10.1 Ajouter le lien « Tournois » dans `src/components/Header.tsx` (barre du haut et barre mobile) ; vérifier que `npm run lint`, `npm run typecheck` et `npm test` passent
- [x] 10.2 Répétition générale dans l'app lancée : un tournoi boutique de 6 joueurs (2 comptes, 2 invités, 2 papier) en Bo1 sur 3 rondes, avec un drop et une contestation ; vérifier que le classement final correspond à un calcul à la main, puis supprimer le tournoi et les comptes `@example.com` créés

## Workflow follow-up

- Archiver le change (`/opsx:archive`) une fois la fonctionnalité relue et validée.
