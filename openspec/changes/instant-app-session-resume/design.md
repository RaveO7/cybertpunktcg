# Design

## Context

Voir proposal.md (Why) pour le constat. État actuel du code :

- `CollectionProvider` expose un seul booléen `ready`. Il ne passe à `true` qu'après `GET /api/auth/session`, puis `GET /api/catalog` et `GET /api/collection` (le catalogue part en parallèle de la session seulement si l'indice `cptcg-signed-in` est présent en `localStorage`).
- `Header` n'affiche la navigation que si `ready && user` ; `RequireUser` affiche « Chargement… » tant que `!ready`, puis `AuthScreen` si `!user`.
- Dans le `catch` du démarrage (erreur réseau, réponse non JSON), `ready` passe à `true` avec `user = null` : l'écran de connexion s'affiche à un utilisateur connecté.
- L'accueil (`src/app/[locale]/page.tsx`) est dynamique : le serveur choisit déjà entre `Landing` et `Dashboard` selon la présence du cookie. La PWA s'ouvre sur `start_url = /<locale>` et reçoit donc `RequireUser > Dashboard`.
- Le service worker sert `/api/auth/session` en « réseau d'abord » (copie en cache après 4 s ou si le réseau échoue).
- Les tests unitaires tournent en environnement `node` (pas de DOM) : la logique à tester doit vivre dans un module pur.

## Goals / Non-Goals

**Goals:**
- Afficher la navigation et le cadre de la page au premier rendu client quand une session est mémorisée.
- Séparer l'état de la session de l'état des données dans le contexte.
- Ne montrer `AuthScreen` qu'après un refus confirmé (401) ou en l'absence de toute session.

**Non-Goals:**
- Rendu serveur de l'utilisateur ou du tableau de bord (les pages restent statiques là où elles le sont).
- Réduire le temps de chargement du catalogue lui-même.
- Changer le cookie, sa durée ou les routes `/api/auth/*`.

## Decisions

### 1. Session mémorisée en `localStorage`, pas de nouveau jeton
Un module pur `src/lib/session-hint.ts` lit, écrit et efface une clé `cptcg-session-user` contenant `{ id, displayName, email }` (le type `AuthUser`). Il reçoit le stockage en paramètre (`Pick<Storage, "getItem" | "setItem" | "removeItem">`), ce qui permet de le tester en `node`. Il gère aussi les exceptions (stockage indisponible, navigation privée) et le JSON invalide.
Elle remplace l'indice booléen `cptcg-signed-in` : la présence d'un utilisateur mémorisé sert aussi à lancer le catalogue en parallèle. L'ancienne clé est effacée à la première écriture.

*Alternatives écartées* :
- Jeton d'accès longue durée lisible par JS : il n'apporte rien par rapport au cookie `httpOnly` de 400 jours et il expose une preuve d'authentification au JavaScript (risque XSS).
- Lire la session côté serveur dans `SiteShell` et la passer au client : toutes les pages deviendraient dynamiques (`cookies()` dans le layout), ce qui casse le rendu statique et le SEO des pages publiques. Cela ne servirait de plus qu'au premier chargement HTML, pas aux pages servies par le service worker.

### 2. Statut de session explicite dans le contexte
`CollectionProvider` expose `session: "unknown" | "signed-in" | "signed-out"` en plus de `ready` (données chargées), qui garde son sens actuel pour les écrans.
- Le rendu serveur et le rendu d'hydratation partent de `"unknown"` avec `user = null`, comme aujourd'hui, pour éviter un écart d'hydratation. Un effet de montage lit la session mémorisée : si elle existe, il passe tout de suite à `"signed-in"` avec cet utilisateur. On utilise `useLayoutEffect` (ou un `useSyncExternalStore` avec instantané serveur nul) pour que la mise à jour arrive avant le premier affichage à l'écran.
- La vérification `GET /api/auth/session` part ensuite comme aujourd'hui. Si elle réussit, l'utilisateur est mis à jour (le nom a pu changer) et mémorisé. Sur un 401, l'état passe à `"signed-out"`, la mémoire est effacée et les données sont vidées. Sur une erreur réseau ou une autre erreur, l'état ne change pas : il reste `"signed-in"` s'il était mémorisé, et `error` est renseigné. Sans mémoire, l'état passe à `"signed-out"` seulement sur un 401 ; sur une erreur réseau, il reste `"unknown"` et `error` s'affiche.

*Alternative écartée* : réutiliser `ready` en le passant à `true` plus tôt. Les écrans s'en servent pour savoir si `catalog` et `items` sont prêts, et `Dashboard` afficherait un tableau vide.

### 3. Consommateurs
- `Header` : `showNav = isSharedView || session === "signed-in"`.
- `RequireUser` : `"signed-in"` → enfants ; `"signed-out"` → `AuthScreen` ; `"unknown"` → l'état de chargement actuel. Avec une session mémorisée, ce dernier cas ne dure qu'une image.
- Les écrans (`Dashboard`, `InvestmentScreen`, `DecksScreen`, `WishlistScreen`, `SettingsScreen`) gardent leur test `ready`/`catalog` et leur propre squelette. Ils sont seulement vérifiés.
- Tous les chemins qui font aujourd'hui `setUser(null)` sur un 401 (`loadBoundData`, `request`, `saveBatch`, `importLines`, etc.) passent par une seule fonction `endSession()`. Elle efface la mémoire, l'utilisateur et les données, et met le statut à `"signed-out"`. `logout` l'appelle aussi.
- `openSession` (connexion, inscription) mémorise l'utilisateur et met le statut à `"signed-in"`.

### 4. Changement de compte et cache
L'effet `sessionKey`, qui vide le cache de données et appelle `router.refresh()` quand le compte change, doit se baser sur l'id de l'utilisateur une fois le statut connu. Cela évite un rafraîchissement parasite au passage de « mémorisé » à « vérifié » pour le même utilisateur. Si l'utilisateur vérifié a un autre id que l'utilisateur mémorisé, c'est traité comme un changement de compte.

## Risks / Trade-offs

- [Session révoquée ailleurs : le cadre du compte s'affiche un instant avant le 401] → Seules des données d'affichage locales sont montrées, et aucune donnée du compte n'est servie sans cookie valide. Le passage à l'écran de connexion arrive dès la réponse.
- [Utilisateur mémorisé obsolète (nom changé sur un autre appareil)] → Il est corrigé dès la réponse de la vérification.
- [E-mail stocké en `localStorage`] → C'est l'appareil de l'utilisateur, et la valeur est effacée à la déconnexion et sur 401. On pourrait se passer de l'e-mail si `Header`/`SettingsScreen` ne l'affichent pas avant la vérification. À trancher à l'implémentation sans changer la spec.
- [Écart d'hydratation si la mémoire est lue pendant le rendu] → Elle est lue seulement après le montage (décision 2).
- [Utilisateurs connectés avant ce changement : seul l'ancien indice existe] → Leur premier démarrage se comporte comme aujourd'hui. La vérification réussie mémorise l'utilisateur, et les démarrages suivants sont instantanés.

## Migration Plan

Aucune migration de données. Déploiement normal ; retour arrière par revert du commit (l'ancienne clé `cptcg-signed-in` n'étant plus écrite, un retour arrière fait seulement perdre le chargement parallèle du catalogue au premier démarrage).
