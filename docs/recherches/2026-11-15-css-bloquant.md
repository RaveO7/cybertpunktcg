# CSS bloquant le premier affichage : note de décision (2026-11-15)

Constat : Lighthouse signale 2 feuilles CSS bloquantes sur 22 audits sur 24 (−250 à −300 ms en mobile, −60 à −70 ms en desktop). Versions : Next 16.3.6 (Turbopack), Tailwind 4.3.3.

## Mesure (production, mêmes 2 fichiers sur toutes les pages)

| Feuille | Brut | Transféré (brotli) | Contenu |
|---|---|---|---|
| `43uk9jtzyo2tw.css` | 7,6 Ko | 1,5 Ko | `@font-face` Geist (next/font) |
| `2zozjfbnpm332.css` | 123 Ko | 18,6 Ko | Tailwind + `globals.css` (layout racine) |

Composition de la grosse feuille (brut) : utilitaires Tailwind 66 % · `.demo-*`/`dm-*` 8,6 % · accueil `cp-*`/dialogue de carte 6,7 % · `hero-fan` 1,5 % · base/thème/@property Tailwind 9 % · reste de `globals.css` 8 %.

Gains simulés (recompilation Tailwind hors projet, brotli) :
- limiter le scan Tailwind à `src/` : −30 o (aucun faux positif venant de scripts/docs) ;
- sortir tout le tutoriel (CSS `.demo-*` + utilitaires propres à `DemoMatch`, `CoachCallout`, `demo-card-moves`) : 18,6 → 15,8 Ko (−15 %). Il ne sert qu'à `/comment-jouer` (connecté) ;
- sortir aussi l'accueil (`public-site/`, `hero-fan`, `cp-*`) : → 13,2 Ko (−29 %), mais l'accueil, page la plus auditée, le chargerait quand même.

Le coût mesuré par Lighthouse (mobile simulé : 150 ms de latence, ~1,6 Mbit/s) ≈ 1 aller-retour (150 ms) + transfert de 18,6 Ko (~90 ms). La latence pèse plus que la taille.

## Options

| Option | Gain estimé (mobile) | Risque | Effort |
|---|---|---|---|
| **A. `experimental.inlineCss: true`** : tout le CSS dans un `<style>` du HTML, plus aucune feuille bloquante | ~150 à 250 ms sur la 1re visite, audit éteint | Expérimental. CSS non mis en cache à part : retéléchargé avec chaque HTML (+18,6 Ko br, HTML accueil 27,8 → ~46 Ko br). Doc : styles dupliqués dans le payload RSC au 1er chargement. Les navigations internes repassent à `<link>`. Prod seulement | 1 ligne ; mesure preview avant/après |
| **B. Styles d'une seule page dans un CSS Module** (tutoriel → `DemoMatch.module.css`, avec `@reference` pour `@apply`) | −2,8 Ko br ≈ −15 à −20 ms ; audit toujours présent | Faible ; à surveiller : ordre de cascade des modules, utilitaires partagés | ~0,5 j (≈ 800 lignes à déplacer, classes à renommer en `styles.x`) |
| **C. Nettoyage** (règles mortes via Coverage, `source("..")`) | Négligeable selon la mesure (−30 o pour le scan) | Nul | 0,5 j pour peu de gain |

Écartés : `optimizeCss` (critters/beasties) ne s'applique qu'au Pages Router (aucun appel dans `app-render`). `cssChunking` ne change rien : il n'y a déjà qu'une seule feuille d'app. Déplacer le CSS de l'accueil n'aide pas l'accueil : il le charge de toute façon.

## Recommandation

**A seule, validée sur une preview** : Lighthouse mobile et desktop avant/après sur `/fr` et `/fr/cards`, taille du HTML et TTFB. C'est la seule option qui supprime l'aller-retour, la vraie cause des 250 ms. La doc la recommande justement pour du Tailwind (CSS atomique, petit) et les premières visites. B est un nettoyage sain mais ne gagne que ~15 ms : à faire plus tard, à part.

## Points non confirmés

- Poids réel de la duplication RSC avec `inlineCss` (HTML total, et effet sur le LCP si le HTML grossit trop) : à mesurer sur la preview.
- Visiteurs qui reviennent souvent (PWA connectée) : ils paieraient ~18 Ko de plus par page HTML au lieu d'un CSS en cache.
- Interaction avec le service worker (mode hors-ligne) : à vérifier, puisque le CSS ne serait plus un fichier à part.

## Sources

- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/inlineCss.md`, `cssChunking.md`, `01-app/01-getting-started/11-css.md` ; `next/dist/server/config-shared.js`
- https://tailwindcss.com/docs/detecting-classes-in-source-files · https://tailwindcss.com/docs/functions-and-directives (`@reference`)
- Mesures : feuilles de prod téléchargées le 2026-11-15, recompilation `@tailwindcss/postcss` (minify) hors projet
