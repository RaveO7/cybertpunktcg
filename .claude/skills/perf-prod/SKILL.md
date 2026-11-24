---
name: perf-prod
description: Mesure répétable du site en ligne (ou d'une preview) — temps de chargement réels page par page (visuel complet, chargement complet, LCP, poids, requêtes), scores Lighthouse mobile et ordinateur, et anomalies visibles (erreurs console, requêtes en échec, images cassées), pages publiques et privées (compte de test). Chaque mesure est enregistrée et comparée à la précédente. À utiliser pour « teste le vrai site », « Lighthouse », « le site est-il rapide », « mesure les perfs », ou avant/après une optimisation. Argument optionnel : libellé de la mesure, URL de preview, ou liste de pages.
---

Demande : $ARGUMENTS

## Avant de mesurer (protocole fixe, à ne pas me redemander)

1. **Secteur** : `(Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus).PowerOnline` doit valoir `True`. Sur batterie (TBT ×5 à ×30) : ne pas mesurer, me demander de brancher. Une mesure faite sur batterie est jetée.
2. **Machine calme** : aucun `next dev`/`next start`, build, e2e ni autre mesure en cours (le hook avant push en lance : pousser *après* la mesure « avant », pas pendant).
3. **Brave** : noter s'il est ouvert (`tasklist | grep -ci brave`). Il occupe le GPU et double le TBT ; le fermer seulement si je l'ai dit, sinon le laisser dans le même état pour l'avant et l'après, et l'indiquer dans le compte rendu. Pas de `--disable-gpu` (protocole différent de l'historique).
4. **Témoin** : inclure `cgu` dans chaque série (`--only cgu,<pages>`). Référence ≈ 98 mobile, TBT ≈ 160 ms. Si le témoin bouge de plus de 5 points entre l'avant et l'après, la machine a changé : le dire, et ne conclure que sur le LCP (moins sensible à la charge), pas sur la note.
5. **Même protocole** avant et après : mêmes `--only`, même `--runs` (3 par défaut, médiane), même cible (prod contre prod, preview contre preview), l'une juste après l'autre.

## Lancer la mesure

```
npx tsx scripts/perf-audit.ts --label "<libellé court : ce qui a changé>"
```

- Une seule mesure à la fois sur la machine (verrou commun à tous les worktrees) : une mesure lancée pendant une autre attend sa fin, sinon les deux se partagent processeur et réseau et les chiffres sont faux.
- Durée : ~30 min complet (13 pages × 2 profils × 3 visites + 3 passages Lighthouse). Lancer en arrière-plan (`run_in_background`).
- Preview protégée (Vercel Authentication) : `VERCEL_AUTOMATION_BYPASS_SECRET=<secret>` (secret « Protection Bypass for Automation » du projet, `vercel api /v9/projects/<id>` → `protectionBypass`).
- Options : `--url https://<preview>.vercel.app` · `--runs 5` (plus stable) · `--only accueil,catalogue` · `--no-lighthouse` (rapide) · `--public-only` (sans compte).
- Pages et identifiants : `scripts/perf/pages.ts`. Ne pas renommer ni retirer une page (comparaison perdue) ; en ajouter est sans risque.
- Pages privées : compte de test `EMAIL_USER_TEST` / `EMAIL_PASSWORD_TEST` dans `.env.local`. Le script ouvre une session et la ferme à la fin, même en cas d'échec ; il ne fait que des lectures.

## Lire le résultat

- Tableau par profil (mobile, desktop), écart à la mesure précédente : flèche = sens de la variation (`▲` hausse, `▼` baisse), `✓` mieux, `✗` moins bien ; pas de flèche sous le bruit (100 ms, 2 points Lighthouse, 3 % de poids).
- Colonnes : `TTFB` premier octet · `LCP` plus grand élément affiché · `Visuel` dernière image visible reçue (la page « a l'air finie ») · `Complet` dernière ressource reçue, réseau calme 1 s · `CLS` décalage de mise en page · `Ko` poids transféré · `Req` requêtes · `LH` scores Lighthouse sur 100.
- Temps Playwright = réseau réel de la machine (médiane de N visites à froid) : comparer des mesures faites depuis la même connexion. Lighthouse simule réseau et processeur : médiane de N passages (`--runs`), un passage où Lighthouse plante est écarté (signalé « ⚠ … passage écarté ») et remplacé, 2 essais en plus au maximum. Garder le même `--runs` d'une mesure à l'autre pour comparer.
- Avant/après d'une modification : mesurer les deux dans les mêmes conditions, l'une juste après l'autre, avec les mêmes options (`--only`, `--runs`), depuis la même connexion. Une preview contre la prod reste biaisée (cache CDN froid sur la preview, SEO ▼ car une preview est en noindex) : comparer de préférence deux previews (une de `main`, une de la branche). La barre d'outils Vercel des previews est désactivée par le script (en-tête `x-vercel-skip-toolbar`).
- Rapports Lighthouse détaillés : `test-results/perf-lighthouse/<page>-<profil>.report.html` = passage médian ; chaque passage dans `<page>-<profil>-<n>.report.html` (dernière mesure seulement, non versionnés).
- Version de Lighthouse : 13.6 depuis le 2026-11-22 (celle de PageSpeed Insights). Jusqu'à la 12.8, le LCP mobile simulé comptait tout le JS téléchargé avant l'affichage, même non bloquant : les mesures antérieures ont des notes mobiles plus basses (accueil 82 contre 97) et ne se comparent pas aux suivantes.
- Comparer deux mesures quelconques : `npx tsx scripts/perf-audit.ts --compare docs/perf/history/<avant>.json docs/perf/history/<après>.json`.

## Rendre compte

1. Le tableau (ou seulement les lignes qui bougent) et les anomalies, avec pour chaque anomalie : bug réel, bruit attendu, ou à décider.
2. Les 3 pistes d'amélioration les plus rentables tirées des rapports Lighthouse (section « Opportunités ») — sans les appliquer.
3. Commiter le fichier `docs/perf/history/<date>.json` (`chore: mesure de performance <libellé>`) : c'est l'historique de comparaison.
