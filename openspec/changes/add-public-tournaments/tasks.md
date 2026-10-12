# Tasks

## 1. Schéma et outillage

- [ ] 1.1 Ajouter à `prisma/schema.prisma` : champs de `Tournament` (D3, colonnes de lieu D1, index D2), statut `waitlist` documenté sur `TournamentPlayer`, modèle `Shop` (D10), `User.role`, table `GeocodeCache` ; vérifier avec `node scripts/prisma.mjs db push` sur une copie SQLite locale puis `npm run typecheck`
- [ ] 1.2 Ajouter `leaflet` (+ `@types/leaflet`) en version exacte et passer `sharp` en `dependencies` ; vérifier `npm install` et `npm run build` sans erreur
- [ ] 1.3 Écrire `scripts/set-role.ts <email> <user|admin>` et `requireAdmin()` à côté de `requireUser` ; vérifier par un test DB (compte `@example.com` créé puis supprimé en `finally`) qu'un compte non admin reçoit 403 et qu'un nouveau compte a le rôle `user`

## 2. Géocodage et distance (`locations/geocoding`)

- [ ] 2.1 Écrire `src/lib/geo/distance.ts` (`haversineKm`, boîte englobante, arrondi d'affichage) et `src/lib/geo/location.ts` (normalisation, `cityKey`, conversion colonnes) ; tests unitaires : Paris–Lyon ≈ 392 km, arrondi au dixième sous 10 km, lieu incomplet refusé
- [ ] 2.2 Écrire `src/lib/geo/geocode.ts` (IGN pour FR avec autocomplétion, Nominatim hors FR sans autocomplétion, User-Agent, limite globale 1 req/s, cache `GeocodeCache` 30 jours, erreur « réessayez ») ; tests unitaires avec `fetch` simulé pour les deux fournisseurs, le cache et l'indisponibilité
- [ ] 2.3 Créer `GET /api/geocode/suggest`, `POST /api/geocode/resolve` (session requise) et `GET /api/geocode/cities` (public, villes connues + communes FR), limite 30/min par IP, purge du cache dans le cron quotidien ; tests de routes (429 après 30 appels, 401 sans session)
- [ ] 2.4 Créer le composant client `AddressField` (choix du pays, suggestions FR dès 3 caractères, saisie rue/CP/ville + « Localiser » hors FR, aperçu carte) et `MapView` (Leaflet en `next/dynamic` sans SSR, regroupement par coordonnées, attribution, tuiles configurables) ; vérifier manuellement sur `npm run dev` une adresse française et une adresse belge

## 3. Boutiques (`shops/profile`)

- [ ] 3.1 Écrire `src/lib/shops/` : création (max 5 par gérant, statut `pending`), slug unique et réservé, mise à jour (retour en `pending` si nom/adresse d'une boutique vérifiée changent), suppression (tournois détachés), validation zod des URL (http/https uniquement) ; tests DB couvrant chaque scénario de la spec, nettoyage en `finally`
- [ ] 3.2 Gérer le logo : validation type/taille via `sharp`, recadrage 256×256 WebP, stockage en base, route `GET /api/shops/[slug]/logo` avec cache long ; tests (5 Mo refusé, GIF refusé, PNG accepté et redimensionné)
- [ ] 3.3 Créer les routes `POST/GET /api/shops`, `GET/PATCH/DELETE /api/shops/[slug]` et `GET /api/shops` publique avec filtres pays/ville/rayon (vérifiées d'abord, refusées exclues) ; tests de routes (403 sur la boutique d'un autre, 404 sur une boutique refusée)
- [ ] 3.4 Créer la page `/compte/boutique` (création, édition, statut de vérification et motif de refus, suppression) avec textes dans les 5 langues ; vérifier dans le navigateur le parcours création → édition → suppression
- [ ] 3.5 Créer la page publique `/boutiques/[slug]` (Server Component, `generateMetadata`, badge, carte, prochains tournois publics, 10 derniers résultats, liens `target="_blank" rel="nofollow noopener"`) et l'annuaire `/boutiques` (liste + carte, filtres) ; vérifier qu'aucun tournoi privé n'apparaît et que la page d'une boutique refusée renvoie 404

## 4. Vérification des boutiques (`shops/verification`)

- [ ] 4.1 Implémenter la revue : `GET /api/admin/shops?status=`, `POST /api/admin/shops/[id]/review` (valider, refuser avec motif obligatoire ≤ 500 caractères, retirer la vérification), enregistrement de la date et de l'admin, nouvelle soumission par le gérant ; tests DB et de routes pour chaque scénario de la spec
- [ ] 4.2 Créer la page `/admin/boutiques` (file triée par ancienneté, onglets par statut, actions) et le lien d'accès visible seulement des admins ; vérifier dans le navigateur avec un compte promu par `scripts/set-role.ts`

## 5. Tournoi public (`tournaments/public-listing`)

- [ ] 5.1 Étendre `tournamentSettingsFields` (date, fuseau, lieu, prix, devise, places, description ≤ 2000, lots ≤ 500) et ajouter les commandes `setVisibility` (champs obligatoires, date future, refus si terminé/annulé, liste des manquants) et `setShop` (gérant de la boutique, boutique non refusée, lieu par défaut de la boutique) ; tests DB pour chaque scénario de la spec
- [ ] 5.2 Écrire `buildPublicView` (aucun code, aucun joueur `pending`, boutique masquée si refusée, classement final si terminé) ; tests unitaires vérifiant l'absence du code et des joueurs en attente
- [ ] 5.3 Créer `GET /api/tournaments/public/[id]` (404 si privé), `POST /api/tournaments/public/[id]/join` (logique commune extraite de `api/t/[code]/join`, rate limit, réponse `{ code }`) et `GET /api/tournaments/public/[id]/calendar` (iCalendar avec fin estimée) ; tests de routes (inscription invité et compte, inscriptions fermées, 404 après dépublication, contenu `.ics`)
- [ ] 5.4 Ajouter l'encadré « Publication » dans `SettingsTab` (visibilité, champs de présentation, `AddressField`, choix de la boutique, champs manquants affichés) avec textes dans les 5 langues ; vérifier dans le navigateur la publication puis la dépublication d'un tournoi
- [ ] 5.5 Créer la fiche `/tournois/publics/[id]` (Server Component, `generateMetadata`, carte, bouton d'inscription qui redirige vers `/t/[code]`, lien calendrier, résultats si terminé) ; vérifier en navigation privée qu'un visiteur anonyme voit la fiche sans le code et peut s'inscrire en invité

## 6. Places et liste d'attente (`tournaments/capacity`)

- [ ] 6.1 Écrire `src/lib/tournament/capacity.ts` (`seatsTaken`, `isFull`, `promoteWaitlist`) et l'appeler depuis `joinTournament` et depuis les commandes qui libèrent une place ou changent `maxPlayers` ; ajouter la commande `promoteWaitlisted` et laisser `addPlayer` ignorer la limite ; tests DB pour chaque scénario de la spec (complet, approbation, désistement, hausse de places, baisse sans désinscription, inscriptions terminées, dépassement volontaire, retrait de la liste)
- [ ] 6.2 Vérifier que l'appariement, le classement et le top cut n'utilisent que les joueurs `active` et corriger sinon ; test unitaire : une ronde appariée avec 2 joueurs `waitlist` ne les contient pas
- [ ] 6.3 Afficher la liste d'attente dans `PlayersTab` (ordre, bouton « Promouvoir ») et la position dans la vue joueur avec possibilité de se retirer ; textes dans les 5 langues ; vérifier dans le navigateur un tournoi de 2 places avec 3 inscrits

## 7. Annuaire (`tournaments/discovery`)

- [ ] 7.1 Écrire la requête d'annuaire (`src/lib/tournament/directory.ts`) : publics, non terminés/annulés, début il y a moins de 12 h, filtres lieu / rayon (boîte + haversine) / période / format / Bo / prix / places / inscriptions ouvertes / boutique, tri date ou distance puis boutique vérifiée, pagination 50, mode carte 500 ; tests DB couvrant chaque filtre, le tri et l'exclusion des privés
- [ ] 7.2 Créer `GET /api/tournaments/public` (paramètres validés par zod) et les listes de choix pays → régions → villes limitées aux tournois à venir ; tests de routes (filtres combinés, paramètres invalides → 400)
- [ ] 7.3 Créer la page `/tournois/publics` (premier rendu serveur, filtres synchronisés avec l'URL, géolocalisation avec repli sur la saisie de ville, bascule liste/carte, badge vérifié) avec textes dans les 5 langues ; vérifier dans le navigateur qu'un lien avec filtres se rouvre à l'identique et que le refus de géolocalisation laisse l'annuaire utilisable
- [ ] 7.4 Ajouter l'accès « Tournois publics » dans `TournamentsScreen` et dans la navigation, accessible sans compte (`AppFrame`) ; vérifier en navigation privée

## 8. Intégration

- [ ] 8.1 Lancer `npm run lint`, `npm run typecheck`, `npm test` et `openspec validate add-public-tournaments --strict` ; tous doivent passer, et la base locale ne doit contenir aucune donnée de test restante
- [ ] 8.2 Parcours de bout en bout sur `npm run dev` : créer une boutique, la valider en admin, publier un tournoi rattaché, le trouver dans l'annuaire par rayon, s'inscrire en invité, remplir le tournoi puis vérifier la liste d'attente et la promotion ; supprimer ensuite toutes les données créées

## Workflow follow-up

- Archiver `add-tournament-management` avant d'archiver ce change (ses specs servent de base aux capacités `tournaments/*`).
- Archiver ce change après revue, puis vérifier que les 6 specs sont apparues dans `openspec/specs/`.
