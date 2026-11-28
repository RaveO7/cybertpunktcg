# Audit accessibilité (WCAG 2.1 AA) — octobre 2026

Audit en lecture seule : grille de cartes, modales, contrastes du thème. **[V]** = vérifié dans le code ; **[S]** = déduit du CSS, à confirmer dans un navigateur. Les numéros de ligne datent de l'audit.

## Grille et clavier

| Gravité | Critère | Où | Constat | Correctif |
|---|---|---|---|---|
| Bloquant | 2.4.7 | `CardTile.tsx:104` | [S] Le `<button>` de la carte n'a aucun style de focus et le contour par défaut est rogné par l'`overflow-hidden` de la carte : focus invisible. | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan` |
| Important | 1.3.1 / 1.4.1 | `CardTile.tsx:75,107` | [V] L'état « possédée » n'est porté que par la bordure et l'opacité ; rien pour les lecteurs d'écran. En thème clair la bordure est quasi invisible (1,04:1). | `<span className="sr-only">` « possédée ×N » + pastille visible |
| Important | 4.1.2 / 4.1.3 | `CardTile.tsx:158-168`, `CardsExplorer.tsx:930-941` | [V] Mode ajout : sélection non exposée, compteur sans libellé, récapitulatif et erreur hors zone live. | `aria-pressed`, `aria-label` sur le compteur, `role="status"` |
| Important | 4.1.3 | `CardsExplorer.tsx:826-830` | [V] Le nombre de résultats change sans annonce. | `role="status" aria-live="polite"` |
| Important | 2.4.3 | `VirtualCardGrid.tsx:231-262` | [S] La virtualisation démonte la carte focalisée (défilement, navigation dans la modale, changement de colonnes) : le focus retombe sur `body`. Pas de flèches. | Mémoriser l'id focalisé, `scrollToIndex` + refocus ; à terme roving tabindex (`role="grid"`) |
| Mineur | 3.1.2 | `CardTile.tsx:121,163,172` | [V] Libellés en français codés en dur. | Passer par `t.*` |

## Modales et dialogues

| Gravité | Critère | Où | Constat | Correctif |
|---|---|---|---|---|
| Important | 2.4.3 | `CardModal.tsx:339-351` | [V] `role="dialog"`/`aria-modal` OK mais pas de piège de focus : Tab part sous le voile. | `inert` sur le fond ou boucle Tab |
| Important | 2.4.3 | `CardModal.tsx:224-226`, `CardsExplorer.tsx:569-577` | [V] Focus non restauré à la fermeture. | Revenir à la carte affichée (`scrollToIndex` puis focus) |
| Important | 2.1.2 / 2.4.3 | `CardsExplorer.tsx:892-916` (quitter le mode ajout), `HowToPlayScreen.tsx:169-201` | [V] Ni focus initial, ni Échap, ni piège, ni restauration. | `autoFocus` sur « Rester », Échap, `inert`, refocus |
| Important | 2.4.3 | `CardsExplorer.tsx:700-705` (tiroir de filtres) | [V] Échap OK mais focus ni déplacé ni restauré. | Focus sur Fermer, retour au bouton filtres |
| Mineur | 2.4.3 | `CardModal.tsx:373,385,1043,1200` | [S] Focus perdu en fin de liste ←/→, après suppression ou quantité à 0. | Déplacer le focus vers un élément voisin |
| Mineur | 2.4.6 | `CardModal.tsx:1201` | [V] Même `aria-label` « supprimer » sur toutes les lignes. | Inclure l'état et la quantité |

Conforme : Échap ferme la modale, défilement bloqué, Fermer et ←/→ étiquetés.

## Formulaires et divers

- **Important** — `FilterPanel.tsx:226-233` : puces de filtre sans `aria-pressed` (état seulement en couleur).
- **Mineur** — `FilterPanel.tsx:263-268` : champ sans libellé (placeholder seul). `FilterPanel.tsx:167`, `AuthScreen.tsx:202` : aides non reliées (`aria-describedby`). `AuthScreen.tsx:134-153` : `tablist` incomplet. `Header.tsx:86` : `aria-pressed` sur un lien → `aria-current="page"`. Pas de lien d'évitement.
- **Mineur** — mouvement réduit : `CardTile.tsx:115` (`group-hover:scale-105` → `motion-reduce:transform-none`), `HowToPlayScreen.tsx:149` (`behavior: "smooth"` inconditionnel).
- Conforme : `lang` sur `<html>` synchronisé, `alt` sur toutes les images, champs de connexion étiquetés, boutons icône étiquetés.

## Contrastes

Seuils : 4,5:1 pour le texte, 3:1 pour le grand texte et les éléments d'interface. Alpha composé sur le fond réel.

**Thème sombre (par défaut)** : le texte principal, le texte atténué, les accents, les boutons et les indicateurs de focus passent tous (≥ 5:1). Échecs :

| Combinaison | Ratio |
|---|---|
| Rareté Rare `#3b82f6` sur sa teinte 12 % | 4,38 |
| Rareté Epic `#ef4444` sur sa teinte 12 % | 4,39 |
| Bordure de champ `--line` `#2c384c` / panel (1.4.11) | 1,56 |

**Thème clair** : nombreux échecs.

| Combinaison | Ratio |
|---|---|
| Nom de carte `text-white` (`CardTile:126`) / hud-panel | 1,05 |
| `text-[#c4cede]` (`RulesText.tsx:184`) / hud-panel | 1,51 |
| foreground sur `bg-[#05060a]` (`CardAnatomy.tsx:160,237`) | 1,14 |
| foreground sur `bg-[#0d1118]` (`CoachCallout.tsx:122`) | 1,06 |
| Jaune `#b89200` (titre de la modale) / background · panel | 2,52 / 2,94 |
| Cyan `#0b8fa8` (texte, liens) / background · panel | 3,27 / 3,81 |
| gain `#1f9d63` / panel | 3,46 |
| Texte atténué à 80 % (COST/PWR) | 3,50 |
| Placeholder | ≈3,3 |
| Pastilles d'état NM · LP · MP · PO (`CardModal:87-97`) | 2,54 à 3,71 |
| Puce de filtre active | 2,67 |
| Raretés Uncommon · Rare · Epic · Nova · Secret | 3,03 à 4,37 |
| Bordure de champ / panel | 1,56 |
| Bordure « possédée » codée en dur | 1,04 |
| Anneaux de focus cyan/70 · jaune/70 | 2,49 / 2,07 |

## Priorités

1. Focus visible sur les cartes (`CardTile.tsx:104`).
2. Gestion du focus des dialogues (piège ou `inert`, Échap, restauration) : un hook commun `useDialogFocus(ref, onClose)`.
3. Thème clair : supprimer les couleurs codées en dur (`text-white`, `#c4cede`, `#05060a`, `#0d1118`, bordure possédée), foncer `--yellow`, `--cyan` et `--gain` jusqu'à au moins 4,5:1.
4. Exposer les états : « possédée », sélection en mode ajout, puces de filtre (`aria-pressed`), nombre de résultats (`role="status"`).
5. Bordures de champ à 3:1 (token `--field-border`) ; texte des raretés Rare/Epic légèrement éclairci en sombre.

## Corrigé (lot accessibilité de novembre 2026)

- Focus visible sur les cartes (anneau intérieur cyan, `CardTile.tsx`) ; état « possédée » annoncé aux lecteurs d'écran (texte `sr-only`, clé `cards.ownedCount`).
- Thème clair : `--yellow` `#b89200` → `#7f6400` (2,52 → 4,83:1 sur `--background`), `--cyan` `#0b8fa8` → `#08748a` (3,27 → 4,64:1), `--gain` `#1f9d63` → `#157a4b` (2,97 → 4,59:1). Les aplats `bg-yellow` / `bg-cyan` portant du texte noir gardent l'ancienne teinte (`--yellow-fill`, `--cyan-fill`).
- Couleurs codées en dur remplacées par les tokens : `CardTile` (`text-white`), `QuickAddSheet`, `RulesText` (`#c4cede`), `CardAnatomy` (`#05060a`), `CoachCallout` (`#0d1118`). La bordure « possédée » codée en dur n'a pas été touchée.
- Lien d'évitement « Aller au contenu » vers `<main id="contenu">` (`AppFrame`).
- Puces de filtre en `aria-pressed` ; champ de recherche des listes de filtres nommé (`aria-label`) ; bordure de champ des filtres via le token `--line-field` (3,14:1 en clair, 3,66:1 en sombre).
- Défilement « retour en haut » du tutoriel : instantané si `prefers-reduced-motion`.
- Pages d'erreur globales : `<html lang>` mis à la langue de l'URL (`GlobalFallback`).
- Info-bulle « Eddies » traduite ; tris `localeCompare` suivant la langue courante.

## Corrigé (second lot, novembre 2026)

- Dialogues : tous passent par `useModal` (`src/components/use-modal.ts`) — focus initial, Tab bouclé, fond `inert`, Échap, retour du focus. Couverts : fiche de carte, quitter le mode ajout (`LeaveAddModeDialog`, focus initial sur « Rester »), quitter le parcours (`HowToPlayScreen`), ajout rapide, tiroir de filtres, aperçu et confirmation des decks, éventail de l'accueil, et le parcours débutant plein écran du téléphone (`DemoMatch`, Échap = la croix de sortie).
- Nombre de résultats en `role="status"` (`ResultSummary`).
- Mode ajout : récapitulatif de la sélection en `role="status"` et erreur d'ajout en `role="alert"` (`SelectionBar`) ; compteur de la tuile annoncé « N exemplaires à ajouter » (clé `cards.queuedCount`). Les tuiles exposent déjà `aria-pressed` pendant la sélection au clavier ; un simple clic ouvre l'ajout rapide, ce n'est pas un bouton à bascule.
- `--danger` en clair : `#d63b4c` → `#b8293a` (3,92 → 5,27:1 sur `--background`, 4,52:1 sur sa teinte 10 %).
- `fieldClass` de `AuthScreen`, `card-modal/shared.ts` et `QuickAddSheet` sur `--line-field`.
- Anneaux de focus : plus aucun `ring-*/70` ni `ring-yellow/80`, couleur pleine (en clair, cyan 2,80 → 4,64:1, jaune 2,81 → 4,83:1, danger 2,69 → 5,27:1 sur `--background`).
- Raretés (texte des pastilles, teinte 12 % sur `--panel`) : en sombre Rare `#60a5fa` (4,37 → 6,04) et Epic `#f87171` (4,40 → 5,70) ; en clair Uncommon `#08704d` (5,13), Rare `#1d4ed8` (5,56), Epic `#b91c1c` (5,28), Nova `#7a6200` (4,97), Secret `#545e6d` (5,53), Common inchangé (4,72).

- Champs écrits à la main hors `fieldClass` passés sur `--line-field` : état, quantité et prix de `AddCopyForm` (ordinateur et téléphone) et `CollectionLines`, prix cible des listes de souhaits (`WishlistScreen`, `WishlistPanel`), recherche du catalogue (`CardsExplorer`). Contraste de la bordure sur les fonds de ces champs : en sombre 4,33 (`--background`), 3,99 (`--panel`), 3,66:1 (`--panel-2`) ; en clair 3,14, 3,67, 3,35:1. Les séparateurs internes (filet entre le prix et la devise) restent sur `--line`.

- Tous les autres champs de saisie passés sur `--line-field` : `inputClass` de `tournament/ui.tsx` (tournois, boutiques, annuaire public, adresses), recherche du tableau de bord, tri et état du mode ajout du catalogue, recherche, extension, nom, partage et import/export des decks, filtres et tri de l'investissement, prix de l'ajout rapide, réglages et partage du classeur. `--line` reste réservé aux bordures décoratives (cadres, séparateurs, boutons).

Reste ouvert : rien.
