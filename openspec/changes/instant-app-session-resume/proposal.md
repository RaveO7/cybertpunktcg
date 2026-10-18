# Proposal

## Why

À chaque ouverture de l'application installée (PWA), un utilisateur déjà connecté voit pendant environ 2 secondes un en-tête sans navigation et un écran vide (« Chargement… »), qui ressemble à la page de connexion. Ensuite seulement le tableau de bord apparaît. Le compte, lui, n'a jamais été déconnecté : le cookie de session dure déjà 400 jours et il est prolongé à chaque ouverture. Cette « clé » existe donc déjà. Le délai vient du client : il n'affiche ni la navigation ni la page tant qu'il n'a pas fini trois requêtes à la suite, la session (`/api/auth/session`), puis le catalogue complet et la collection. Pendant ce temps, l'état « session inconnue » s'affiche comme l'état « pas connecté ».

## What Changes

- Au démarrage, l'application reprend tout de suite la session mémorisée sur l'appareil : l'en-tête avec sa navigation et le cadre de la page s'affichent dès le premier rendu, sans attendre le serveur. La session reste vérifiée en arrière-plan.
- Le client distingue « session connue » et « données chargées » : la navigation et les pages réservées aux comptes ne dépendent plus du chargement du catalogue et de la collection. Chaque écran affiche son propre squelette de chargement tant que ses données ne sont pas là.
- L'écran de connexion ne s'affiche que si le serveur a confirmé l'absence de session (401) : une erreur réseau ou une lenteur ne fait plus apparaître le formulaire de connexion à un utilisateur connecté. Aujourd'hui, une erreur au chargement donne `ready = true` avec `user = null`, donc l'écran de connexion.
- Une session refusée par le serveur (expirée, révoquée, compte supprimé) efface la session mémorisée et ramène à l'écran de connexion, comme aujourd'hui.
- La déconnexion efface la session mémorisée.

Pas de nouveau jeton ni de nouvelle « clé » : l'authentification reste le cookie `httpOnly` existant. Seules les informations d'affichage (id, nom, e-mail) sont mémorisées sur l'appareil.

**Hors périmètre** : accélérer le téléchargement du catalogue lui-même (taille, cache du service worker) ; un rendu serveur du tableau de bord ; une connexion automatique sans cookie (lien magique, biométrie, jeton longue durée).

## Capabilities

### New Capabilities
- `account/session` : reprise de la session d'un compte au démarrage de l'application, affichage pendant la vérification, et retour à l'écran de connexion quand la session n'est plus valide.

### Modified Capabilities
<!-- Aucune : aucune spec existante ne couvre la session des comptes. -->

## Impact

- `src/components/CollectionProvider.tsx` : statut de session séparé de `ready`, reprise de la session mémorisée, gestion des erreurs réseau au démarrage, effacement à la déconnexion et sur 401.
- Nouveau module pur (par ex. `src/lib/session-hint.ts`) : lecture, écriture et effacement de la session mémorisée ; il remplace l'indice actuel `cptcg-signed-in`.
- `src/components/site/RequireUser.tsx` et `src/components/Header.tsx` : s'appuient sur le statut de session, plus sur `ready`.
- Écrans qui utilisent `ready` (`Dashboard`, `InvestmentScreen`, `DecksScreen`, `WishlistScreen`, `SettingsScreen`) : à vérifier. Ils gardent leur propre état de chargement.
- Pas d'API, de base de données, de cookie ni de dépendance modifiés.
