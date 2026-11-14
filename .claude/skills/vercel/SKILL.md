---
name: vercel
description: Tout ce qui touche à Vercel pour ce projet — déploiements (preview, production), variables d'environnement, logs et erreurs de prod, cron d'import des prix, domaines, rollback. À utiliser dès qu'il est question de Vercel, de déployer, de la prod, d'un preview, d'une variable d'env ou d'une erreur en ligne.
---

# Vercel — cybertpunktcg

Projet `perfectpornproject/cybertpunktcg`, déjà lié (`.vercel/project.json`). CLI installée et connectée (`vercel whoami`). Région `fra1` (`vercel.json`).

## Comment le projet se déploie
- **Git** : seules les branches `livraison/*` (train de livraison, niveau `complet`) créent un **preview** (`cybertpunktcg-git-<branche>-perfectpornproject.vercel.app`) ; les autres branches ne déploient rien (`git.deploymentEnabled` de `vercel.json`). Un merge sur `main` déploie la **production**, sauf s'il ne touche rien du site depuis le dernier déploiement réussi (`ignoreCommand` → `scripts/livraison-niveau.mjs --vercel`, statut CANCELED). Ne pas déployer à la main sauf demande explicite.
- **Build** (`npm run build`) : `prisma generate` → `scripts/vercel-db-push.mjs` (en **production uniquement**, `db push` aligne Postgres sur `prisma/schema.prisma` ; un changement destructeur fait échouer le build sans rien toucher) → miniatures → `next build`.
- **Cron** : `GET /api/cron/import-prices` chaque jour à 05:00 UTC, protégé par `CRON_SECRET` ; il invalide le cache `catalog`.

## ⚠ Base de données
- `DATABASE_URL` / `POSTGRES_URL` / `PRISMA_DATABASE_URL` pointent sur la **base Postgres de production pour les 3 environnements** (Production, Preview, Development). Un preview écrit donc dans la vraie base.
- **Ne jamais lancer `vercel env pull`** vers `.env` ou `.env.local` : la machine locale serait branchée sur la prod (en local, `DATABASE_URL` doit rester `file:...`). Pour connaître une valeur : `vercel env ls`, ou demander.
- Envoyer des données locales vers la prod : `/sync-prod` uniquement.

## Variables d'environnement
- Lister : `vercel env ls` (noms et environnements, valeurs masquées).
- Ajouter : `vercel env add <NOM> <production|preview|development>` — action visible en prod : **demander avant**. Puis l'ajouter à `.env.example` (sans valeur) et la lire côté serveur seulement (règle `donnees.md`).
- Une `NEXT_PUBLIC_*` est figée au build : redéployer après l'avoir changée.
- Utilisées par le code : `APP_URL`, `TRUST_PROXY`, `CRON_SECRET`, `ALERT_WEBHOOK_URL`, `OAUTH_STATE_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY`, `ANDROID_PACKAGE_NAME/CERT_SHA`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_MAP_TILE_URL/ATTRIBUTION`, `NEXT_PUBLIC_WISHLIST_ENABLED`, `NEXT_PUBLIC_EBAY_CAMPAIGN_ID`, `NEXT_PUBLIC_CARDNEXUS_PARTNER_ID`. Vérifier avec `vercel env ls` celles qui manquent sur Vercel avant d'en dépendre.

## Diagnostiquer (lecture seule, à faire sans demander)
- Derniers déploiements : `vercel ls` (production : `vercel ls --environment production`).
- Détail et logs de build d'un déploiement : `vercel inspect <url> --logs`.
- Logs d'exécution (erreurs 500, timeouts, cron) : `vercel logs --environment production --since 1h` (fenêtre par défaut : 30 min) ; un déploiement précis : `--deployment <url>` ; filtrer : `--query "<texte>"`, sortie exploitable : `--json`.
- Erreur serveur : chercher aussi `reportError` (`src/lib/monitoring.ts`) — les erreurs y sont journalisées en JSON, et envoyées sur `ALERT_WEBHOOK_URL` si défini.
- Build en échec : lire les logs, reproduire en local avec `npm run build` (avec `DATABASE_URL=file:...`), corriger, pousser.

## Actions visibles en production — toujours demander avant
`vercel --prod` / `vercel deploy --prod`, `vercel rollback`, `vercel promote`, `vercel env add|rm`, `vercel domains …`, toute modification du projet sur le tableau de bord. Après accord : lancer, puis vérifier avec `vercel ls` et `vercel inspect`.

## Fonctions et cron
- Runtime Node (Fluid Compute), durée max par défaut 300 s ; `export const maxDuration = …` dans la route si besoin. Pas de `runtime = "edge"`.
- Travail après la réponse (journal, notification) : `after()` de `next/server`, jamais une promesse non attendue.
- Nouveau cron : entrée dans `vercel.json` + route `src/app/api/cron/<nom>/route.ts` qui vérifie `CRON_SECRET` comme `import-prices`.
