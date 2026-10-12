# Design

## Context

- App Next.js 16 (App Router, route handlers dans `src/app/api/**/route.ts`), Prisma 6, SQLite en local et Postgres en production. `prisma/schema.prisma` est la seule source ; `scripts/prisma.mjs` génère le schéma SQLite. La base est mise à jour par `db push` (pas de migrations SQL).
- Les deux bases imposent de **ne pas utiliser d'enums Prisma** ni de colonnes `Json` : le projet stocke les états en `String` et le JSON en `String` (ex. `PortfolioHistoryCache.pointsJson`). On suit cette convention.
- Auth existante : cookie de session httpOnly `cptcg_session` (`src/lib/auth.ts`), `requireUser(request)`. Validation des corps JSON obligatoire via `readJsonBody` + zod (`src/lib/api-schemas.ts`). Limiteur de débit en base (`src/lib/rate-limit.ts`).
- Toutes les relations vers `User` sont aujourd'hui en `onDelete: Cascade`. Il n'existe pas encore de route de suppression de compte, mais les tests suppriment des `User` pour nettoyer : un tournoi ne doit donc pas dépendre en cascade d'un `User`.
- Tout est traduit en 5 langues (FR, EN, DE, ES, IT) (`src/lib/i18n/messages.ts`), mobile d'abord, navigation dans `src/components/Header.tsx`.

Les exigences sont dans `specs/tournaments/*`. Ce document décrit comment les réaliser.

## Goals / Non-Goals

**Goals :**
- Toute la logique de tournoi (appariement, classement, top cut, transitions d'un match, chrono) en **fonctions pures** testables sans base.
- Un **seul point d'entrée de commandes** pour les organisateurs, idempotent, pour rendre la file hors connexion sûre.
- Des écrans à jour par simple sondage HTTP, peu coûteux.

**Non-Goals :**
- Pas de WebSocket ni de push temps réel (le sondage suffit à l'échelle d'une boutique).
- Pas de scanner QR intégré : le QR contient une URL, ouverte par l'appareil photo du téléphone.
- Pas d'import/export Melee.gg, pas d'enregistrement des decklists, pas de pénalités de jeu au-delà du no-show, de la double défaite et de la DQ.
- Pas de file hors connexion côté joueur : un joueur sans réseau peut toujours faire saisir son score par le TO.

## Decisions

### 1. Modèle de données

```
Tournament          id, code (unique, 6 car.), name, format, matchType, roundMinutes,
                    topCutExtraMinutes (25), topCutSetting, swissRounds, status,
                    registrationOpen, requireApproval, oneDeviceMode ("direct"|"organizer"),
                    declareTimeoutMinutes (10), lateEntryPolicy ("zero"|"loss"),
                    revision (Int, +1 à chaque écriture), cutDrawJson?, championId?, timestamps
TournamentOrganizer tournamentId → Tournament (Cascade), userId → User (Cascade), role ("owner"|"co")
                    @@unique([tournamentId, userId])
TournamentInvite    tokenHash (unique), tournamentId (Cascade), expiresAt, usedAt?
TournamentPlayer    id, tournamentId (Cascade), userId? → User (SetNull), name, nameKey,
                    status ("pending"|"active"|"dropped"|"dq"), dqReason?, joinedRound, missedRounds,
                    droppedAfterRound?, cutDeclined, deviceTokenHash? (unique),
                    claimTokenHash? (unique), claimExpiresAt?, createdAt
                    @@unique([tournamentId, nameKey]), @@unique([tournamentId, userId])
TournamentRound     id, tournamentId (Cascade), number, phase ("swiss"|"top_cut"),
                    status ("draft"|"published"|"running"|"closed"), startedAt?, durationSeconds,
                    pausedAt?, pausedSeconds, addedSeconds        @@unique([tournamentId, number])
TournamentMatch     id, roundId (Cascade), table, bracketSlot?, playerAId, playerBId? (null = bye)
                    → TournamentPlayer (Restrict), status, kind ("normal"|"bye"|"double_loss"|
                    "id"|"no_show"), gamesA?, gamesB?, declAJson?, declBJson?, declaredAt?,
                    confirmedOnSite, extraSeconds, version (Int)
TournamentMatchLog  id, matchId (Cascade), actorUserId?, actorPlayerId?, action, beforeJson,
                    afterJson, createdAt
TournamentAction    tournamentId (Cascade), clientActionId, resultJson, createdAt
                    @@id([tournamentId, clientActionId])
```

- **Aucune relation `Tournament → User`.** Le TO est une ligne `TournamentOrganizer`. Si le compte du TO principal est supprimé, sa ligne disparaît (cascade) et le co-organisateur le plus ancien est promu `owner` à la lecture suivante. Sans organisateur restant, le tournoi reste consultable en lecture seule. Le joueur garde son `name` (le pseudo est déjà une copie, pas une jointure sur `User.displayName`).
- **`nameKey`** = pseudo en minuscules, sans accents (NFD + suppression des diacritiques), espaces réduits. Il porte l'unicité et la détection des pseudos proches.
- **Déclarations séparées (`declAJson` / `declBJson`)** : chaque joueur écrit dans sa propre case, donc deux déclarations simultanées ne peuvent pas s'écraser. Le passage `valide`/`conteste` est calculé après l'écriture.
- **`revision` du tournoi = verrou optimiste** : chaque transaction d'écriture commence par `updateMany({ where: { id, revision: lue }, data: { revision: +1 } })`. Si aucune ligne n'est mise à jour, un autre organisateur ou joueur a écrit entre-temps : on relit et on rejoue la commande (au plus 5 essais). Toutes les écritures d'un même tournoi sont ainsi sérialisées, sur SQLite comme sur Postgres, sans `SELECT … FOR UPDATE`. La même `revision` sert au sondage (voir 5).
- **`version` sur le match** : incrémentée à chaque changement du match. Le client l'envoie avec `setResult` ; elle sert à détecter qu'un autre organisateur a validé un autre score entre-temps (409), pas à verrouiller.
- **Pas de classement stocké** : il est recalculé à chaque lecture à partir des matchs validés (quelques centaines de matchs au plus). Le tirage au sort d'une égalité au seuil est, lui, stocké (`cutDrawJson`) car il ne doit pas changer d'une lecture à l'autre.
- **Arrivée en retard en mode « défaite »** : pas de match fictif. Le classement compte les rondes manquées (`missedRounds` : retard, plus les rondes manquées entre un drop et une réintégration) comme des matchs perdus pour le joueur seul (0 point, dénominateur du MW% augmenté), sans effet sur l'OMW% de quiconque.
- Alternative écartée : une table d'« inscriptions » séparée du joueur pour les comptes et les invités. Elle aurait dupliqué toute la logique d'appariement selon l'origine du joueur, ce que la spec interdit.

### 2. Logique pure dans `src/lib/tournament/`

| Fichier | Rôle |
|---|---|
| `code.ts` | génération et normalisation du code (alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, `crypto.randomInt`), `nameKey` |
| `scores.ts` | validation des scores selon bo1/bo3/phase, gagnant, points |
| `match-state.ts` | transitions : `declare`, `confirm`, `refuse`, `confirmOnSite`, `organizerSet`, `noShow`, `reset` → nouvel état + entrée de journal. Retourne une erreur typée en cas de refus |
| `standings.ts` | points, MW%, GW%, OMW%, OGW% (plancher 33 %), tri, égalités, classement final |
| `pairing.ts` | ronde 1 aléatoire, bye, appariement suisse, échanges manuels, détection des revanches |
| `blossom.ts` | appariement parfait de poids maximal (algorithme d'Edmonds), port de `networkx.max_weight_matching` |
| `top-cut.ts` | taille du cut, sélection, arbre 1–N, tour suivant, propagation d'une correction |
| `clock.ts` | temps restant à partir de (`startedAt`, durée, pauses, ajouts, temps de table, `serverNow`) |

**Appariement suisse = appariement de poids maximal sur un graphe complet**, plutôt qu'un parcours glouton avec retour arrière :
- Le bye est choisi avant, selon la règle de la spec, puis retiré du graphe.
- Le poids d'une paire combine, du plus au moins important : une pénalité énorme pour une revanche, l'écart de points au carré, puis l'écart de rang.
- On obtient ainsi en une seule passe « pas de revanche si possible », « sinon le minimum de revanches », et « descente au groupe inférieur » pour un joueur seul, sans risque d'explosion combinatoire.
- Alternative écartée : un glouton avec retour arrière, qui peut échouer ou devenir exponentiel en fin de tournoi avec peu de joueurs (le cas « 4 joueurs, 4e ronde »).
- On porte l'algorithme dans le projet (environ 250 lignes) plutôt que d'ajouter une dépendance peu suivie. Il est testé contre une force brute sur de petits effectifs.
- Le hasard (ronde 1, tirage d'égalité) passe par un générateur injectable : production = `crypto`, tests = déterministe.

### 3. Un point d'entrée de commandes pour les organisateurs

`POST /api/tournaments/[id]/actions` avec `{ clientActionId, type, ...payload }`, où `type` est l'un de : `updateSettings`, `regenerateCode`, `setRegistration`, `addPlayer`, `renamePlayer`, `removePlayer`, `approvePlayer`, `rejectPlayer`, `mergePlayers`, `issueClaim`, `dropPlayer`, `undropPlayer`, `disqualify`, `pairRound`, `swapPlayers`, `moveBye`, `publishRound`, `startRound`, `pauseClock`, `resumeClock`, `adjustClock`, `addTableTime`, `setResult`, `noShow`, `closeRound`, `declineCut`, `inviteOrganizer`, `removeOrganizer`, `cancel`.

- Schéma zod en union discriminée sur `type`.
- **Idempotence** : avant d'agir, on cherche `TournamentAction(tournamentId, clientActionId)`. Si la ligne existe, on renvoie le résultat enregistré. Sinon on agit et on insère la ligne dans la même transaction. La file hors connexion peut donc renvoyer une action sans risque de doublon.
- **Conflits** : `setResult` porte la `version` du match vue par le client. Si le match a changé entre-temps avec un autre score validé, la réponse est 409 avec les deux scores, et l'UI demande au TO de trancher.
- Contrôle des droits centralisé : l'appelant doit être organisateur. Seul l'owner peut faire `cancel`, `inviteOrganizer` et `removeOrganizer`. `setResult` sur le match d'un organisateur-joueur est traité comme une déclaration de joueur.
- Alternative écartée : une route REST par ressource. Il aurait fallu disperser l'idempotence et l'ordre de la file dans trente routes.

Autres routes :
- `GET/POST /api/tournaments` (mes tournois, création).
- `GET /api/tournaments/[id]/state?rev=N` (sondage, voir 5).
- `GET /api/t/[code]` (résolution du code, vue publique).
- `POST /api/t/[code]/join` (inscription, limitée en débit).
- `POST /api/t/claim` (récupération via QR personnel).
- `POST /api/tournaments/[id]/player` (commandes joueur : `declare`, `confirm`, `refuse`, `confirmOnSite`, `drop`, `withdraw`).
- `POST /api/tournaments/invite/[token]` (accepter une invitation de co-organisateur).

### 4. Identité de l'appareil joueur

- À l'inscription invité ou à la récupération d'un profil, le serveur crée un jeton aléatoire de 32 octets. Seule son empreinte SHA-256 est stockée (`deviceTokenHash`), sur le modèle des sessions existantes. Il est posé dans un cookie httpOnly `cptcg_tp_<tournamentId>` (SameSite=Lax, 30 jours).
- Une nouvelle récupération remplace l'empreinte, ce qui déconnecte l'ancien appareil.
- Un joueur lié à un compte est reconnu par sa session de compte sur n'importe quel appareil.
- « A l'app » (pour choisir le mode de saisie) = `deviceTokenHash != null || userId != null`.
- Le QR personnel encode `${APP_URL}/t/claim/<jeton>`. Le jeton est aléatoire, son empreinte est stockée avec `claimExpiresAt = now + 15 min`, et il est effacé dès son utilisation.
- Le QR du tournoi encode `${APP_URL}/t/<CODE>`.
- Les QR sont générés côté client en SVG avec la bibliothèque `qrcode`.

### 5. Rafraîchissement par sondage avec révision

- Le client appelle `/state?rev=N` toutes les 5 s quand la page est visible (`visibilitychange`), et juste après chacune de ses actions.
- Si `revision == N`, la réponse est minuscule : `{ unchanged: true, serverNow }`. Sinon c'est un instantané complet, adapté au rôle : la vue TO inclut les brouillons et le journal, la vue joueur seulement ce qui est publié.
- `serverNow` sert à corriger l'horloge du téléphone pour le chrono : `offset = serverNow - (t_envoi + t_réception)/2`.
- Les états « en attente trop longue » sont calculés à la lecture (`declaredAt + timeout < now`). Pas besoin de cron.
- Alternative écartée : SSE ou WebSocket (possible sur Vercel Fluid). C'est plus de complexité pour un gain marginal à cette échelle. On pourra y passer plus tard sans changer l'API de commandes.

### 6. File hors connexion de l'organisateur

- Module client `src/lib/tournament/offline-queue.ts` : une file par tournoi dans `localStorage` (chaque accès dans un try/catch), où chaque action reçoit un `clientActionId` (`crypto.randomUUID()`).
- L'UI applique l'action de façon optimiste sur l'instantané local et affiche « N actions non synchronisées ».
- La file est vidée dans l'ordre à l'événement `online`, au sondage suivant et au chargement de la page. On s'arrête sur une erreur réseau. Une erreur 4xx retire l'action de la file et l'affiche en « conflit » au TO.
- Seules les actions du TO passent par la file. Les commandes joueur exigent le réseau.

### 7. Interface

- `/tournois` : mes tournois (organisés et joués) et le bouton de création.
- `/tournois/[id]` : console du TO, avec les onglets **Joueurs** (ajout papier, QR, fusion, drop…), **Ronde** (brouillon → publier → démarrer, chrono, liste des matchs triée « contestés / en attente trop longue / à saisir / déclarés / validés »), **Classement** et **Réglages**.
- `/t/[code]` : page publique du joueur. Elle propose l'inscription si l'appareil n'est pas inscrit, sinon affiche ma table, mon adversaire, le chrono, la déclaration et la confirmation, les appariements et le classement.
- `/t/claim/[token]` : page de récupération de profil.
- Lien « Tournois » ajouté dans `Header.tsx`, textes dans les 5 langues de l'app (FR, EN, DE, ES, IT) dans `messages.ts`.
- Avant d'écrire les pages et les routes, relire les guides Next 16 dans `node_modules/next/dist/docs/` (paramètres dynamiques asynchrones, route handlers), comme l'exige `AGENTS.md`.

## Risks / Trade-offs

- [Charge du sondage sur Vercel et Postgres pendant un tournoi de 64 joueurs] → la réponse `unchanged` ne lit qu'une colonne. Le sondage est suspendu quand la page est cachée. On mesure avant d'envisager SSE.
- [Bug dans l'algorithme de blossom = appariements faux en tournoi] → tests de propriété contre une force brute (N ≤ 10, des centaines de cas aléatoires), et le TO peut toujours corriger avant le démarrage.
- [Code de tournoi deviné ou partagé hors de la boutique] → 31⁶ ≈ 887 millions de codes, limite de 20 essais par minute et par IP, option d'approbation, fermeture des inscriptions, régénération du code.
- [Invité qui perd son cookie] → le QR personnel, régénérable par le TO à tout moment.
- [Action en file appliquée sur un état devenu différent] → 409 avec les deux versions, jamais d'écrasement silencieux.
- [Confirmation « sur le même téléphone » falsifiable par le déclarant] → acceptable en boutique. Le réglage « validation par le TO » existe pour les événements plus sérieux, et le journal garde la trace « confirmé sur place ».
- [Correction d'un ancien résultat qui rend les appariements suivants « injustes »] → c'est le comportement standard des tournois (on ne réapparie pas une ronde jouée). L'avertissement rend la situation visible.
- [Écart entre SQLite et Postgres sur la concurrence] → verrou optimiste par `revision` du tournoi, plutôt qu'un `SELECT … FOR UPDATE` propre à Postgres.
- [Tests qui laissent des tournois en base, puisqu'ils ne sont pas en cascade depuis `User`] → les tests suppriment explicitement les `Tournament` créés dans un `finally`, en plus des `User`.

## Migration Plan

1. Ajouter les modèles dans `prisma/schema.prisma`. Le changement est purement additif, sans modification des modèles existants à part les relations inverses sur `User`.
2. En local : `node scripts/prisma.mjs db push`, puis la génération du client. En production, `scripts/vercel-db-push.mjs` l'applique au build.
3. Livrer d'abord la logique pure et les routes, puis l'UI. Le lien de navigation n'est ajouté qu'en dernier, ce qui permet de déployer sans exposer la fonctionnalité.
4. Retour arrière : retirer le lien de navigation. Les tables peuvent rester sans effet sur le reste de l'app.
