# Audit Lighthouse 13.6 : problèmes signalés et gains réels (2026-11-22)

Mesure : production, 12 pages × mobile/desktop, `perf-audit --runs 3` (`docs/perf/history/2026-11-22-10-06-57.json`), Lighthouse 13.6.0. Chaque piste a été testée : A/B Lighthouse en local (build de prod de `main` contre build modifié, passages alternés, outil `scripts/perf/lighthouse.ts`, compte de test local supprimé ensuite), ou traces Chrome sur la prod.

## Ce que Lighthouse signale

| Audit | Pages | Gain annoncé | Verdict après test |
|---|---|---|---|
| LCP (métrique) | toutes en mobile | — | **Cause principale des notes < 90**, voir ci-dessous |
| `unused-javascript` | toutes | 23–25 Kio (46 Kio paramètres) | Chunk React DOM (non réductible). Paramètres : +23 Kio (`lib/logic.ts`, `collection-csv.ts`) chargeables à la demande, ≈ 8 Kio compressés : gain négligeable |
| `render-blocking-insight` | toutes | 100–150 ms mobile | Feuille Tailwind de 20 Kio. CSS en ligne testé (#42) puis retiré (#58) : HTML 2,6× plus lourd, pire au total. Rien à gagner |
| `mainthread-work-breakdown` / `bootup-time` | 9 pages mobile | TBT 300–800 ms | React DOM (~800 ms d'exécution simulée) + chunk commun de l'app (i18n, en-tête, providers : 400–600 ms). Pas de levier sûr chiffré (recherche web : aucun gain mesuré publié) |
| `image-delivery-insight` | collection desktop | 98 Kio | Reflets `card-ambilight` (images en double, flou). Desktop déjà à 99 |
| `bf-cache` | collection | — | `Cache-Control: no-store` sur `/fr/cards` : confort au retour arrière, pas de note |
| `forced-reflow-insight` | collection | 42 ms | Dans React DOM : négligeable |
| `lcp-discovery-insight` | catalogue desktop | — | `fetchpriority=high` absent du préchargement : desktop déjà à 100 |
| `label-content-name-mismatch` | pages publiques | — | Sélecteur de langue (`aria-label` « Langue : Français », texte « FR ») : accessibilité, hors note (100) |
| `is-crawlable` | pages privées | — | Voulu (`noindex`) |

## La vraie cause : le texte principal arrive après le JS

Lighthouse 13.6 ne compte le LCP comme le FCP que si le plus grand texte est peint **au premier affichage** et ne bouge plus. Sinon, tout le JS téléchargé avant son affichage entre dans le LCP simulé (≈ +2 s sur mobile).

| Page (mobile) | Note | Élément LCP | Pourquoi il arrive tard |
|---|---|---|---|
| CGU, accueil, catalogue | 90–98 | texte du HTML serveur | rien : LCP = FCP |
| Connexion | 84–89 | texte du formulaire | `useSearchParams` dans `LoginScreen` : sans `fallback`, la `<Suspense>` laisse le formulaire hors du HTML serveur |
| Decks, tournois, tableau de bord, accueil connecté, investissement, paramètres | 75–92 | intro de la page, ou logo de l'écran de démarrage | le serveur rend l'écran de démarrage (`RequireUser`), puis chaque écran affiche un squelette ; le vrai titre n'apparaît qu'après le JS et les données |
| Fiche carte | 83–91 | image de la carte | image peinte ~575 ms après son téléchargement, après le JS (règle 13.6 réservée au texte) |
| Collection | 65–76 | image d'une carte | grille rendue côté client après catalogue et collection |

## Tests

| Essai | Avant | Après | Constat |
|---|---|---|---|
| Connexion : formulaire rendu par le serveur (`fallback` de la `Suspense` = `AuthScreen`) | 84 (LCP 3,99 s) | **96** (LCP 1,25 s) | 5 passages chacun, gain stable |
| Pages connectées : contenu au lieu de l'écran de démarrage | 74–85 | 73–83 | Sans effet seul : les écrans affichent encore un squelette |
| + titre et intro de Decks en clair dans le squelette | 80 | 81 (médiane) | **94** quand le texte n'est pas remplacé ensuite (1 passage sur 5) ; sinon, l'écran final recrée le même paragraphe et Chrome le compte comme un nouvel affichage |
| Fiche carte, 3 passages | 83–91 | — | LCP fixe à 3,1 s ; la note varie avec le TBT (199–414 ms) |

## Ce qui vaut la peine

1. **Connexion** (+8 à +12 points, 1 fichier) : `fallback` serveur pour le formulaire. Le paramètre `mode=register` s'applique après hydratation (onglet par défaut avant).
2. **Pages connectées** (+10 à +14 points sur 6 pages, si bien fait) : un en-tête de page (titre + intro) rendu par le serveur **au même endroit de l'arbre** que l'écran final (sorti des squelettes et des écrans, jamais remplacé), et l'écran de démarrage réservé au cas « aucune session ». Travail page par page, à vérifier par A/B comme ci-dessus.
3. Le reste (JS inutilisé, CSS bloquant, images desktop, reflow) : moins de 2 points chacun, ou déjà testé sans gain.

Non résolus sans refonte : LCP image de la fiche carte et de la collection (rendu serveur des premières cartes de la collection), TBT dû à React.
