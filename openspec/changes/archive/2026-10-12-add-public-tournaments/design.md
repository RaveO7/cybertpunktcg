# Design

## Context

Voir proposal.md (Why) pour la motivation et les specs pour les exigences.

État actuel utile :
- `Tournament` n'a ni lieu, ni date, ni visibilité ; l'accès se fait par code (`/t/[code]`, rate-limité) ou par l'id (cuid), et `buildView` (src/lib/tournament/view.ts) masque déjà le code pour le rôle `public`.
- `joinTournament(tournamentId, viewer, name)` (src/lib/tournament/join.ts) porte toutes les règles d'inscription dans une transaction `writeTournament` qui incrémente `revision`. Statuts joueur : `pending | active | dropped | dq`.
- Pas de rôle global, pas de boutique, pas de stockage de fichiers, pas de bibliothèque de carte.
- Base : Postgres en production, SQLite en local (schéma dérivé par `scripts/prisma.mjs`, déploiement par `db push`). Les états sont des chaînes, pas des enums. Pas de PostGIS (indisponible en SQLite).
- `rateLimit(key, limit, windowMs)` (src/lib/rate-limit.ts) est partagé entre instances via la table `RateLimit` ; un cron quotidien purge les compteurs.
- UI client avec `fetch` + sondage, Tailwind v4, i18n maison (src/lib/i18n/messages.ts, 5 langues). Next.js 16 : lire `node_modules/next/dist/docs/` avant d'écrire pages, `generateMetadata` et route handlers.

## Goals / Non-Goals

**Goals :**
- Réutiliser le moteur de tournoi tel quel : un tournoi public est un tournoi normal avec des champs en plus.
- Requêtes d'annuaire identiques en SQLite et en Postgres, sans extension.
- Pages publiques (fiche tournoi, page boutique) rendues côté serveur pour être indexables et partageables.
- Aucun service payant ni clé d'API.

**Non-Goals :**
- Recherche plein texte, géocodage inverse, déplacement manuel du repère sur la carte.
- Plusieurs gérants par boutique (un seul propriétaire en v1).
- Notifications (e-mail / push) de promotion en liste d'attente : l'information est visible dans la vue joueur.

## Decisions

### D1. Lieu stocké en colonnes à plat, pas dans une table `Location`
`Tournament` et `Shop` reçoivent les mêmes colonnes : `venueName?`, `address`, `postalCode?`, `city`, `cityKey` (normalisée sans casse ni accents, comme `playerNameKey`), `region?`, `country` (ISO-2), `lat`, `lng` (Float), plus `timeZone` (IANA) sur `Tournament`. Une fonction `toLocationColumns()` / `fromLocationColumns()` dans `src/lib/geo/location.ts` évite la duplication.
*Alternative écartée* : table `Location` partagée — une jointure de plus sur la requête la plus fréquente (annuaire) pour peu de gain ; copier l'adresse de la boutique dans le tournoi est de toute façon le comportement voulu (un tournoi garde son lieu si la boutique déménage).

### D2. Filtre par rayon = boîte englobante en SQL + haversine en mémoire
Index `@@index([visibility, startsAt])`, `@@index([country, cityKey])`, `@@index([lat, lng])`. Pour un rayon R autour de (lat, lng), la requête filtre `lat BETWEEN lat±R/111` et `lng BETWEEN lng±R/(111·cos lat)` (gestion de l'antiméridien inutile en pratique, mais bornée proprement), puis `haversineKm()` (src/lib/geo/distance.ts) élimine les coins et calcule la distance affichée. Tri par distance en mémoire sur l'ensemble filtré (borné à 500), puis pagination.
*Alternative écartée* : PostGIS / `earthdistance` — indisponible en SQLite local, et le volume attendu (centaines à quelques milliers de tournois à venir) ne le justifie pas.

### D3. Visibilité et nouveaux champs de tournoi
`Tournament` : `visibility` (`private` | `public`, défaut `private`), `startsAt DateTime?`, `timeZone String?`, colonnes de lieu (nullables), `entryFeeCents Int?` (null = gratuit), `currency String @default("EUR")`, `maxPlayers Int?`, `description String?`, `prizes String?`, `shopId String?` (relation `Shop`, `onDelete: SetNull`), `publishedAt DateTime?`.
Les champs passent par la commande organisateur existante `updateSettings` (schéma zod étendu) ; deux nouvelles commandes : `setVisibility { public: boolean }` (contrôle des champs obligatoires, renvoie la liste des manquants dans `details`) et `setShop { shopId: string | null }` (contrôle de propriété, état non refusé). Ainsi la file hors connexion et le verrou `revision` restent valables sans code nouveau. Le fuseau est proposé depuis `Intl.DateTimeFormat().resolvedOptions().timeZone` du navigateur de l'organisateur, modifiable.

### D4. Liste d'attente = nouveau statut joueur `waitlist`
Ajout du statut `waitlist` à `TournamentPlayer.status`. La position est l'ordre de `createdAt` parmi les joueurs `waitlist` (pas de colonne de position à maintenir). Toute la logique est dans `src/lib/tournament/capacity.ts` :
- `seatsTaken(t)` = joueurs `active` + `pending` ; `isFull(t)`.
- `joinTournament` : si `isFull`, création en `waitlist` (au lieu de `active`/`pending`).
- `promoteWaitlist(tx, t)` : appelée à la fin des commandes qui libèrent une place (`withdraw`, `removePlayer`, `rejectPlayer`, `dropPlayer`, `disqualify`, `updateSettings` sur `maxPlayers`), seulement si une inscription est encore possible (même condition que `join`). Promeut avec `joinedRound` / `missedRounds` recalculés par `nextJoinRound`.
- Nouvelle commande organisateur `promoteWaitlisted { playerId }` (dépassement volontaire) ; `addPlayer` ignore la limite.
L'appariement, le classement et le top cut doivent ne prendre que les joueurs `active` : à vérifier dans `pairing.ts` / `standings.ts` et à corriger si un filtre se contente d'exclure `dropped`/`dq`.

### D5. Inscription sans code : route publique qui délègue à `joinTournament`
`POST /api/tournaments/public/[id]/join` : charge le tournoi, répond 404 s'il n'est pas `public`, applique `limitCodeAttempts` (scope dédié), puis exécute exactement le chemin de `api/t/[code]/join` (extraction de la logique commune — viewer, cookie d'appareil — dans `src/lib/tournament/http.ts`). Réponse : `{ code }` pour rediriger vers `/t/[code]` (le joueur inscrit a le droit de voir le code).

### D6. Vue publique dédiée
`buildPublicView(t)` (src/lib/tournament/public-view.ts) renvoie uniquement les champs de la fiche : présentation, lieu, compteurs (inscrits = `active`, en attente = taille de la liste d'attente, places restantes), boutique (si non refusée : nom, slug, logo, vérifiée), et, si terminé, champion + classement final calculé par le module `standings` existant. Jamais de code, d'ids de joueurs, de joueurs `pending`, de logs. Les pages publiques n'utilisent jamais `buildView`.

### D7. Pages publiques en Server Components, annuaire en composant client piloté par l'URL
- `/tournois/publics/[id]` et `/boutiques/[slug]` : Server Components lisant la base directement, `generateMetadata` (titre, description, ville) ; bouton d'inscription et carte en îlots client.
- `/tournois/publics` et `/boutiques` : un composant client qui lit/écrit les filtres dans `useSearchParams` et appelle `GET /api/tournaments/public` / `GET /api/shops` ; un Server Component parent fournit la première page pour un rendu immédiat.
- Fichier `.ics` : route handler `GET /api/tournaments/public/[id]/calendar` (`text/calendar`), généré à la main (format simple, pas de dépendance), fin estimée = `startsAt + swissRounds × roundMinutes + 15 min × swissRounds`.

### D8. Carte : Leaflet + tuiles OpenStreetMap
`leaflet` (version exacte figée) chargé uniquement côté client via `next/dynamic` avec `ssr: false`, dans un seul composant `src/components/geo/MapView.tsx` (repères, regroupement par coordonnées identiques fait à la main, popup avec liens). URL des tuiles et attribution configurables (`NEXT_PUBLIC_MAP_TILE_URL`, défaut `tile.openstreetmap.org`) pour pouvoir changer de fournisseur sans code.
*Alternative écartée* : MapLibre GL — plus lourd (WebGL, ~800 Ko) pour un besoin de simples repères ; Google Maps — clé et facturation.

### D9. Géocodage côté serveur, deux fournisseurs, cache en base
`src/lib/geo/geocode.ts` expose `suggestAddresses(q, country)` et `resolveAddress(parts, country)`, appelés par `GET /api/geocode/suggest` et `POST /api/geocode/resolve` (session requise : seuls des organisateurs / gérants saisissent des adresses) et `GET /api/geocode/cities` (public, pour l'annuaire).
- France : Géoplateforme IGN (`data.geopf.fr/geocodage/search`, `autocomplete=1`), qui autorise l'autocomplétion.
- Autres pays : Nominatim (`format=jsonv2&addressdetails=1`), **sans autocomplétion** (interdite par sa politique d'usage), un appel par clic « Localiser », `User-Agent` identifiant l'app, limite globale `rateLimit("geocode:nominatim", 1, 1000)`.
- Limite par IP : 30 / minute. Cache : nouvelle table `GeocodeCache { key, resultJson, createdAt }` (clé = fournisseur + requête normalisée), durée 30 jours, purge dans le cron quotidien existant.
- Suggestions de villes de l'annuaire : `SELECT DISTINCT country, cityKey, city, avg(lat), avg(lng)` sur les tournois publics à venir et boutiques non refusées, complété par les communes françaises de l'IGN (`type=municipality`). Aucune requête Nominatim depuis l'annuaire.
- La géolocalisation du navigateur reste côté client : seules les coordonnées arrondies (2 décimales) sont envoyées en paramètre de recherche, jamais stockées.

### D10. Boutique et vérification
Modèle `Shop` : `id`, `slug @unique`, `ownerId` (User, `onDelete: Cascade`), `name`, `description?`, `website?`, `socialsJson?`, `phone?`, `contactEmail?`, `hoursJson?`, colonnes de lieu (D1, non nulles), `logo Bytes?`, `logoUpdatedAt?`, `status` (`pending | verified | rejected`), `reviewNote?`, `reviewedAt?`, `reviewedById String?` (sans relation, pour survivre à la suppression d'un admin), `createdAt`, `updatedAt`. Index `[status]`, `[country, cityKey]`, `[lat, lng]`, `[ownerId]`.
- Logo : validé (type MIME réel via `sharp().metadata()`, ≤ 2 Mo), recadré 256×256 WebP par `sharp` (passe en `dependencies`), stocké en base (≈ 10–20 Ko) et servi par `GET /api/shops/[slug]/logo` avec `Cache-Control` long et `?v=logoUpdatedAt`. *Alternative écartée* : Vercel Blob — un service et une variable d'environnement de plus pour des fichiers minuscules, et rien en local.
- Slug : `slugify(name)` + suffixe `-2`, `-3`… ; liste de slugs réservés (`nouveau`, `admin`, `api`, …).
- Les modifications de nom ou d'adresse d'une boutique `verified` la repassent en `pending` (comparaison dans `updateShop`).

`User.role String @default("user")` (`user | admin`). `requireAdmin(request)` à côté de `requireUser` (src/lib/catalog.ts). Attribution uniquement via `scripts/set-role.ts <email> <role>` (lancé avec `DATABASE_URL` de l'environnement voulu). Page `/admin/boutiques` (client) + `GET /api/admin/shops?status=`, `POST /api/admin/shops/[id]/review { decision, note }`.

### D11. Mise en avant
Ordre de l'annuaire : critère principal (date ou distance), puis `shop.status = verified` en premier, puis `startsAt`, puis `id`. Pas de section « sponsorisée » séparée en v1.

## Risks / Trade-offs

- [Spam de tournois publics par des comptes jetables] → limite de création de tournois publics (rate limit par compte : 10 publications / jour), publication réservée aux comptes (pas aux invités, déjà le cas) ; modération complète hors périmètre.
- [Usurpation d'une vraie boutique par une boutique non vérifiée] → pas de badge ni de mise en avant sans validation ; un admin peut refuser, ce qui masque la page.
- [Politique d'usage OSM / Nominatim (tuiles, 1 req/s, pas d'autocomplétion)] → limite globale, cache, User-Agent, attribution affichée ; fournisseur de tuiles configurable si le trafic augmente.
- [Indisponibilité du géocodeur] → erreur explicite sans perte de saisie ; l'annuaire n'en dépend pas (lieux déjà stockés).
- [Tri par distance en mémoire] → borné à 500 résultats après filtre par boîte ; si le volume grossit, passage à une requête SQL avec calcul de distance (Postgres) sans changer l'API.
- [Liste d'attente : promotion oubliée dans une commande] → `promoteWaitlist` appelée depuis un point central (après chaque commande qui change un statut joueur) et tests DB pour chaque cas des specs.
- [Fuseau horaire erroné] → affiché à côté de l'heure sur la fiche et modifiable par l'organisateur.
- [Changement de schéma en production] → uniquement des ajouts (colonnes nullables ou avec défaut, nouvelles tables) : `db push` sans perte de données.

## Migration Plan

1. Déployer le schéma (ajouts uniquement) : `node scripts/prisma.mjs db push` en local, `scripts/vercel-db-push.mjs` au build en production. Tous les tournois existants deviennent `private` par défaut : aucun changement visible.
2. Promouvoir le premier administrateur avec `scripts/set-role.ts`.
3. Rollback : redéployer la version précédente ; les colonnes et tables ajoutées sont ignorées par l'ancien code.
