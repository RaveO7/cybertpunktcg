---
name: test-mutation
description: Prouve qu'une garde de sécurité ou de cache est vraiment couverte par les tests en ajoutant une mutation (le code sans la garde doit faire échouer un test). À utiliser après avoir ajouté ou modifié un filtre userId, un contrôle d'accès, une vérification de propriétaire ou une invalidation de cache.
---

1. Choisis le script : accès aux données d'un compte → `scripts/mutate-account-checks.ts` ; caches (historique, catalogue) → `scripts/mutate-cache-checks.ts`.
2. Ajoute une entrée au tableau `mutations` : `name` (le bug simulé, en français), `file`, `from` (texte exact de la garde dans le code, unique dans le fichier) et `to` (le même code sans la garde).
3. Lance le script (`npx tsx scripts/mutate-account-checks.ts`, ou `npx tsx scripts/mutate-cache-checks.ts history|catalog`). Chaque mutation doit être **détectée** (un test échoue). Le script restaure toujours les fichiers ; vérifie avec `git status` que le code source n'a pas changé.
4. Mutation non détectée : écris le test manquant (`tests/db/security.test.ts` ou le test de la zone), puis relance jusqu'à détection.
