# Design

## Context

- `siteViewport` ([SiteShell.tsx](../../../src/components/site/SiteShell.tsx)) déclare deux `themeColor` avec `media: "(prefers-color-scheme: light|dark)"`. Next génère deux `<meta name="theme-color" media=…>` ; Chrome Android choisit selon le thème du téléphone. Sur un téléphone en clair, il prend `#e8eef6`, d'où les barres blanches.
- Le thème de l'app vient de `localStorage` (`cptcg-preferences`, `theme: "dark" | "light"`, sombre par défaut). `themeBootScript`, dans le `<head>`, pose `data-theme` et `color-scheme` avant le rendu ; `applyTheme()` ([preferences.ts](../../../src/lib/preferences.ts)) fait de même côté client. `PreferencesProvider` l'appelle au montage, quand le thème change (y compris depuis un autre onglet, via le snapshot synchronisé) et à la réinitialisation.
- Le manifeste PWA (`theme_color`/`background_color` `#07080d`) a été retiré dans `fb3049c`.

## Goals / Non-Goals

**Goals:**
- Une seule source de vérité pour la couleur des barres : le thème de l'app.
- Pas de flash de la mauvaise couleur au chargement.

**Non-Goals:**
- Ajouter un mode « automatique » qui suit le téléphone.
- Gérer la barre de navigation Android par d'autres moyens que `theme-color` (pas d'API web pour ça).

## Decisions

1. **Une seule `themeColor` statique sombre dans `siteViewport`** (`themeColor: "#07080d"`), au lieu des deux variantes `media`.
   - Le HTML rendu par le serveur ne connaît pas la préférence (stockée dans `localStorage`) ; le sombre est la valeur par défaut, donc le bon choix initial.
   - Alternative écartée : garder les deux balises `media` et les réécrire côté client. Deux balises à synchroniser, et le navigateur peut retenir celle dont le `media` correspond. Une seule balise sans `media` est plus simple et sans ambiguïté.
   - Alternative écartée : cookie de thème lu côté serveur. Ça rendrait le layout dynamique (lecture des cookies) pour un gain minime, puisque le script de démarrage corrige avant le premier rendu.

2. **Couleurs centralisées dans `preferences.ts`** : `THEME_CHROME_COLORS: Record<ThemeMode, string> = { dark: "#07080d", light: "#e8eef6" }` (valeurs égales à `--background` de chaque thème dans `globals.css`). `siteViewport` utilise `THEME_CHROME_COLORS.dark`.

3. **`applyTheme(theme)` met aussi à jour `<meta name="theme-color">`** : recherche de la balise et réglage de `content`, avec création si elle est absente. Comme tous les chemins de changement passent déjà par `applyTheme`, rien d'autre à brancher dans `PreferencesProvider`.
   - La logique « trouver ou créer la balise et régler la couleur » est extraite dans une petite fonction pure qui prend un `Document`, pour pouvoir la tester sans navigateur réel.

4. **`themeBootScript` fait la même chose en ligne.** Rien ne garantit que la balise générée par Next soit déjà dans le `<head>` quand le script s'exécute, car cela dépend de l'ordre d'injection. Le script cherche donc la balise, la crée si besoin, puis règle `content` avec la couleur du thème lu. Les couleurs sont injectées depuis `THEME_CHROME_COLORS` via `JSON.stringify`, comme la clé de stockage aujourd'hui. Si Next insère sa balise après le script, il y aurait deux balises : le script supprime donc toutes les `meta[name=theme-color]` existantes avant d'en créer une. Côté client, `applyTheme` (au montage) normalise de nouveau : une seule balise, à la bonne couleur.

## Risks / Trade-offs

- [Ordre des balises dans le `<head>` : la balise de Next peut arriver après le script de démarrage et l'emporter (le navigateur prend en général la première qui correspond, mais ce n'est pas garanti)] → `applyTheme` au montage supprime les doublons et laisse une seule balise. Vérifier l'ordre réel dans le HTML rendu (tâche 2.3).
- [Barre du bas sur l'appli installée (WebAPK) : sans manifeste, Chrome peut colorer la barre de navigation système selon son propre thème plutôt que selon `theme-color`] → vérification sur un vrai téléphone Android en thème clair (tâche 3.1). Si la barre du bas reste blanche alors que celle du haut est noire, la seule solution web est de remettre un manifeste avec `background_color`/`theme_color` `#07080d`. Ça revient sur le retrait volontaire de `fb3049c`, donc ce sera une décision à part, à soumettre à l'utilisateur, pas incluse dans ce changement.
- [Utilisateur en thème clair : le HTML serveur annonce le sombre jusqu'à l'exécution du script] → le script s'exécute dans le `<head>`, avant le premier rendu ; pas de flash visible en pratique.

## Migration Plan

Aucune migration : changement purement client, sans donnée stockée nouvelle. Retour arrière : revenir au commit précédent.
