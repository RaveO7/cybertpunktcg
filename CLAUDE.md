@AGENTS.md

# Règles du projet

## Commandes de vérification

- Vérification rapide (typecheck + lint + tests unitaires en parallèle, sortie courte) : `npm run check`
- Typecheck : `npm run typecheck` · Lint : `npm run lint`
- Un fichier de test : `npx vitest run tests/unit/x.test.ts` · Suites : `npm run test:unit`, `npm run test:db` (base SQLite, en série)
- Captures d'une page modifiée (desktop + mobile, compte de test créé puis supprimé) :
  `CAPTURE_PATHS="fr/collection,fr/decks" npx playwright test capture --project=desktop-chrome --project=pixel`
  → `tests/e2e/screenshots/<appareil>/capture_*.png`. Chemins sans « / » initial ; `CAPTURE_SIGNED_OUT=1` pour un visiteur.
- e2e complets : `npm run test:e2e:desktop`, `npm run test:e2e:mobile` (serveur de test sur le port 3100, à côté du `next dev` sur 3000 ; dans un worktree, port propre au dossier).
- Worktree : fichiers de `.worktreeinclude` copiés. Créé par `EnterWorktree`, le hook `~/.claude/hooks/worktree-prep.mjs` y installe aussi un `node_modules` propre et lance `.claude/worktree-setup` (client Prisma, miniatures). Créé par `claude -w`, il utilise le `node_modules` du projet principal : pour modifier le schéma Prisma, `npm ci` dans le worktree d'abord (sinon le client généré écraserait celui du principal ; un hook bloque).
- Mutations (une garde de sécurité ou de cache est bien testée) : `npx tsx scripts/mutate-account-checks.ts`, `npx tsx scripts/mutate-cache-checks.ts history`.

## Tests : ne jamais polluer la base

Tout test, script de vérification ou essai manuel qui crée quelque chose en base (compte, carte en collection, session, partage, prix, snapshot…) doit **tout supprimer à la fin, même en cas d'échec**.

- Nettoyer dans un `finally` (ou le `.finally()` de `main()`), pas seulement en fin de chemin heureux.
- Mémoriser les ids créés et les supprimer explicitement ; supprimer un `User` suffit pour ses données liées (cascade).
- Ne jamais supprimer ni modifier des données qui n'ont pas été créées par le test. Si le test doit altérer des données existantes (prix, catalogue…), travailler sur une **copie** de `data/collection.db` (voir `tests/db/history-cache.test.ts`).
- Les comptes de test utilisent des e-mails en `@example.com`.
- Ne jamais lancer de test contre la base de production (Postgres sur Vercel) : en local `DATABASE_URL` doit pointer vers SQLite (`file:...`). Un hook bloque aussi ces commandes.

## Livraison (`/livrer`)

- Chaque push de branche crée une preview Vercel ; la fusion dans `main` déploie la production.
- Attendre le déploiement d'un commit (logs affichés si le build échoue) : `node scripts/wait-deploy.mjs [HEAD|<sha>] [--prod]` — en arrière-plan, un build dure 3 à 10 min.
- Test de fumée en lecture seule (12 pages publiques et connectées, desktop + mobile : statut, erreurs console, requêtes en échec, images cassées) : `node scripts/smoke-preview.mjs <url> [--pages /fr,/fr/cards] [--shots <dossier>]`. Production : `https://cybertpunktcg.vercel.app`.
- Les previews sont protégées (Vercel Authentication) : les scripts lisent eux-mêmes la clé `automation-bypass` (`vercel api /v9/projects/<projectId>`) et l'envoient en en-tête `x-vercel-protection-bypass`.
- La CI GitHub Actions ne démarre pas (compte GitHub bloqué pour facturation, 2026-11-12) : s'appuyer sur `npm run check` et la preview.
- **Les previews utilisent la base Postgres de production** : sur une preview, tests en lecture seule (compte de test `EMAIL_USER_TEST` de `.env.local`). Toute vérification qui écrit se fait en local.
- Un build de production lance `db push` sur la base de prod : un changement de schéma destructeur fait échouer le build — me demander avant de fusionner une modification de `prisma/schema.prisma`.

## Base de données

- Local : SQLite (`data/collection.db`). Production : Postgres (Prisma Postgres sur Vercel).
- `prisma/schema.prisma` reste en `postgresql` ; toujours lancer la CLI Prisma via `node scripts/prisma.mjs <commande>`, qui choisit le schéma selon `DATABASE_URL`.
- Modifier le schéma : skill `changement-schema`. Envoyer vers la prod : `/sync-prod` uniquement.

## Pièges

- Arrêter le serveur de dev avant `prisma generate` : sous Windows, le moteur Prisma reste verrouillé tant que Node tourne.
- Vitest qui échoue sur « Cannot read properties of undefined (reading 'config') » : le dossier courant est en `c:\` minuscule (deux copies de Vitest chargées). Relancer après `cd "C:/Users/phoenix/Desktop/prog/cybertpunktcg"`.
- Le set principal s'appelle « Welcome to Night City — Retail » (pas « Extension 001 »).
- Aucun prix de marché inventé : sans guide Cardmarket importé, la valeur reste vide.

# Compact instructions

Garder : la tâche en cours et son change OpenSpec, les fichiers modifiés, les commandes de vérification lancées et leur dernier résultat, les décisions que j'ai prises.
