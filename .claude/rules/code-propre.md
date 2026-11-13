# Code propre (tout le projet)

Ces règles valent pour tout code écrit ou modifié. Le lint et le typecheck vérifient le reste : ne pas les recopier ici.

## Avant d'écrire
- Chercher d'abord ce qui existe (agent `recherche` ou Grep) : utilitaire, composant, schéma Zod, hook. Réutiliser ou étendre ; ne jamais créer une deuxième version d'une chose existante.
- Ouvrir un fichier voisin qui fait déjà la même chose et suivre son modèle (nommage, découpage, gestion d'erreur).

## En écrivant
- Pas de code mort : supprimer ce qu'on rend inutile (fonction, export, prop, clé i18n, fichier). Pas de code commenté.
- Pas d'abstraction, d'option ni de paramètre pour un seul appelant.
- Pas de garde-fou pour un cas que les types excluent déjà (`?.`, `?? fallback`, `try/catch` défensifs).
- Une erreur n'est jamais avalée : `catch` / `.catch(() => …)` vide interdit. Selon le cas : la laisser remonter, l'afficher (message traduit), ou `reportError(source, error)` de `src/lib/monitoring.ts` côté serveur. Ignorer volontairement : un commentaire qui dit pourquoi c'est sans risque.
- Données venant de l'extérieur (réponse HTTP, JSON, `localStorage`, API tierce) : validées par un schéma Zod, jamais `as MonType`.
- États exclusifs : union discriminée (`{ status: "ok"; … } | { status: "error"; … }`) plutôt que plusieurs champs optionnels.
- Erreur attendue (validation, introuvable, refus) : valeur de retour typée ou `fail()` ; `throw` réservé aux bugs.
- Fichier qui dépasse ~400 lignes ou composant qui mélange chargement, état et affichage : découper avant d'ajouter.
- Commentaires en français, pour le « pourquoi » ; identifiants en anglais ; exports nommés (`export default` seulement où Next l'impose).

## Où ranger le nouveau code
- Logique métier et accès base : `src/lib/<domaine>/` (modèle : `src/lib/tournament/` — `service`, `repository`, `errors`). Fonction pure : à côté de son domaine, pas dans `lib/logic.ts`.
- Composant d'une fonctionnalité : `src/components/<fonctionnalité>/` ; à plat dans `src/components/` seulement s'il est partagé par plusieurs fonctionnalités.
- Utilitaire non visuel côté client : `src/lib/client/` (pas dans `src/components/`).
- Nom de fichier : composant en `PascalCase.tsx`, le reste en `kebab-case.ts`. Pas de nouveau fichier fourre-tout (`ui.tsx`, `shared.ts`, `utils.ts`) : nommer selon le contenu.

## Avant de dire « fini »
- Un comportement nouveau ou corrigé a son test (unitaire si pur, `tests/db` s'il touche la base).
- `npm run check` vert, et les tests de la zone.
