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
