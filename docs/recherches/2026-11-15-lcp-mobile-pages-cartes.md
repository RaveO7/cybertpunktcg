# LCP mobile des pages à cartes (fiche, collection, decks) — diagnostic

Objectif visé : note Lighthouse Performance mobile ≥ 92 (mesure prod du 15/11 : fiche 87, collection 76–88, decks 90). Non atteint : les images de cartes ne sont pas la cause principale.

## Comment Lighthouse calcule ce LCP

Le LCP mobile est **simulé** (Lantern, `node_modules/@paulirish/trace_engine/models/trace/lantern/metrics/LargestContentfulPaint.js`) : la page est chargée sans bridage, puis le chargement est rejoué en 4G lente avec **toutes les requêtes terminées avant le LCP observé** (sauf les images en priorité basse) et les scripts évalués avant lui. Le LCP simulé suit donc le volume total chargé au début (polices, JS, catalogue…), pas seulement l'image LCP.

## Élément LCP réel

- **Fiche carte** : l'image de la carte (`thumb/560`, 61 Ko, préchargée en priorité haute, présente dans le HTML). Découverte et priorité déjà correctes.
- **Collection / decks** : le plus souvent le **logo de l'écran de démarrage** (`AppSplash`, `icon-512.webp`), affiché tant que la session n'est pas connue ; les cartes qui suivent sont plus petites et ne le remplacent pas. Parfois la première carte de la grille (collection).

## Leviers mesurés (scénarios rejoués sur une trace de prod, Lantern)

Fiche carte (LCP simulé de référence 3,23 s, note 90) :

| Scénario | LCP | Note |
|---|---:|---:|
| image en 320 px (−55 %) | 3,08 s | 91 |
| image en 400 px | 3,23 s | 90 |
| sans aucune police | 2,63 s | 93 |
| sans Geist latin + latin-ext | 3,00 s | 91 |
| sans Chakra Petch ni Geist Mono | 3,23 s | 90 |
| JS −30 % | 2,93 s | 92 |
| sans le plus gros fichier JS (75 Ko) | 2,93 s | 92 |
| HTML −40 % | 3,08 s | 90 |
| sans préchargement des liens (RSC) | 3,22 s | 90 |

Decks (référence 3,42 s) : sans polices 3,05 s ; sans `/api/catalog` (80 Ko chargé avant l'affichage) 3,12 s ; JS −30 % 3,20 s.

Collection : retirer les images de cartes ne compte que lorsque la première carte est l'élément LCP ; les 3e et 4e préchargées partent en priorité basse et sont hors du calcul.

## Essai écarté : préchargement des cartes 3 et 4 limité aux grands écrans (#48, annulé)

Idée : sur téléphone (2 colonnes), ne plus précharger les 3e et 4e cartes en 400 px. Mesure prod avant/après (5 passages, `2026-11-15-22-50-36` → `2026-11-15-23-05-03`) : poids inchangé (1100 Ko) et « Visuel » mobile de la collection 0,31 → 0,60 s. Le 400 px préchargé n'était pas perdu : la 2e rangée du téléphone le réutilisait ; sans lui, ces cartes arrivent après le JavaScript. Les écarts Lighthouse (collection +9) sont du bruit (pages non touchées : fiche +3, decks −8). Ne pas retenter.

## Pistes restantes (hors de ce chantier)

1. **JavaScript du premier chargement** : le levier le plus net sur toutes les pages (−300 ms pour −30 %).
2. **Police Geist** : le jeu latin-ext (17 Ko) est chargé sur la fiche à cause d'un nom d'illustrateur (« Michał ») dans la table des impressions, découvert tard (après la première mise en page).
3. **`/api/catalog` avant l'affichage** sur les pages privées qui n'en ont pas besoin tout de suite (decks).
4. Chakra Petch (3 graisses) et Geist Mono : sans effet mesurable sur le LCP simulé.

À noter : le LCP « observé » dans le Chrome sans fenêtre de Lighthouse arrive souvent après l'événement `load` (présentation de la première image différée), ce qui élargit encore l'ensemble des requêtes comptées.

## Chantier « JS du premier chargement » (#70, 2026-11-21)

Change OpenSpec `reduire-js-premier-chargement` (archivé).

**Ce qui a été fait :**
- Fiche de carte, ajout rapide et éditeur de decks sont chargés à l'ouverture. JS de départ (build local, non compressé, sans les polyfills `noModule`) : collection 855 → 812 Ko, decks 828 → 765 Ko. Fiche publique inchangée (709 Ko), car elle ne contenait aucune de ces fenêtres.
- Ces fenêtres sont préchargées au repos après `load`, pour rester disponibles hors ligne.
- Le proxy pose un cookie indicateur `cptcg_signed` : collection et catalogue partent du `<head>` même sans session mémorisée sur l'appareil.

**Ce qui a été écarté :**
- Précompilation des traductions (next-intl `precompile`) : elle s'applique aussi au serveur, refuse `t.raw` et ne garde pas les 140 contenus structurés (accueil, légal, règles). Ne pas retenter sans migrer ces contenus.
- `push-client` chargé à la demande : un fichier indisponible ferait échouer la déconnexion, pour un gain de 1,9 Ko.

Les autres modules communs (`CollectionProvider`, `offline-queue`, `i18n/match`, `Header`) servent tous au premier affichage. Le reste du JS (~430 Ko) vient de React et de Next.

**Mesure prod avant/après** (5 passages, à la suite, même machine sur secteur ; `2026-11-21-15-14-02` → `2026-11-21-15-45-22`). Mobile :

| Page | Note | LCP simulé | TBT |
|---|---|---|---|
| Fiche carte | 84 → 92 | 3,25 → 3,19 s | 364 → 133 ms |
| Collection | 84 → 78 | 3,34 → 5,29 s | 255 → 177 ms |
| Decks | 94 → 95 | 2,81 → 2,74 s | 135 → 84 ms |

Sur ordinateur, rien ne change : 100, 98 et 100.

**Lecture des résultats :**
- **Fiche** : son JS n'a pas changé, donc le +8 est du bruit (TBT). Les notes de la fiche relevées ce jour vont de 84 à 92. L'objectif de 92 est atteint sur cette mesure, mais pas de façon fiable.
- **Collection, mesure bimodale** : 2 passages ont un LCP à 3,6 s (élément LCP : le logo de l'écran de démarrage), 3 passages à 5,3 s (élément LCP : l'image d'une carte, observée vers 880 ms). Ce second mode existait avant (5,28 s le matin même).
- **Collection, effet du préchargement** : dans ce second mode, le préchargement au repos (~23 Ko de JS entre 620 et 700 ms, après `load` à 440 ms) se termine avant le LCP observé. Lantern le compte alors dans le LCP simulé. Le décaler de quelques secondes le sortirait du calcul.
- **Effet réel** : la collection et les decks ont un affichage complet plus court (collection 0,92 → 0,76 s, decks 0,80 → 0,73 s). Le poids total de la collection augmente de 39 Ko, car les fenêtres préchargées sont comptées, mais après l'affichage.

### Préchargement décalé de 5 s (#72, 2026-11-21) : sans effet, retiré

Hypothèse testée : sortir le préchargement des fenêtres du LCP simulé de la collection en le lançant 5 s après `load`. Mesure prod mobile (5 passages, `2026-11-21-17-30-03` → `2026-11-21-17-50-54`) : collection 76 → 73, toujours bimodale (3 passages à LCP 5,2–5,6 s, 2 à 3,6 s). L'hypothèse est fausse : sur les passages lents, l'image de carte (élément LCP) a un « délai de rendu » simulé de 3,1 à 3,6 s, le temps que le JS de la page et les réponses catalogue et collection arrivent. Le décalage est retiré (il retardait la mise en cache hors ligne sans rien apporter).

Piste réelle pour la collection : que la première rangée de cartes ne dépende plus du JS client et des données de l'API (rendu serveur des premières vignettes, comme les tuiles du catalogue public de #53), ou que l'écran de démarrage reste l'élément LCP.
