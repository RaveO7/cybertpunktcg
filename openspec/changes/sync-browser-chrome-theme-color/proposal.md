# Proposal

## Why

Sur Android, quand le téléphone est en thème clair, la barre d'état en haut et la barre système en bas (accueil, retour…) restent blanches alors que l'application est en noir. Ça fait un liseré blanc en haut et une bande blanche en bas. La cause : la couleur de ces barres (`theme-color`) suit le thème du **téléphone** (`prefers-color-scheme`), alors que le thème de l'application vient de la **préférence de l'utilisateur**, noire par défaut et indépendante du téléphone.

## What Changes

- La couleur des barres du navigateur et du système (`theme-color`) suit le thème **de l'application**, pas celui du téléphone : noir (`#07080d`) en thème sombre, qui est le thème par défaut, et clair (`#e8eef6`) en thème clair.
- La bonne couleur est en place dès le premier affichage, avant l'hydratation de React. Le script de démarrage qui pose déjà `data-theme` pose aussi cette couleur, sans flash blanc.
- Quand l'utilisateur change de thème dans les réglages (ou réinitialise ses préférences), les barres changent de couleur tout de suite, sans recharger la page.
- Les deux entrées `theme-color` avec `media="(prefers-color-scheme: …)"` sont remplacées par une seule entrée, noire par défaut.

**Hors périmètre** : un mode « suivre le thème du téléphone » (le choix reste sombre ou clair, comme aujourd'hui) ; le retour du manifeste PWA, retiré volontairement (voir design.md, Risques) ; les couleurs à l'intérieur de l'application.

## Capabilities

### New Capabilities
- `site/theme` : thème visuel de l'application (sombre par défaut, clair au choix de l'utilisateur) et accord des barres du navigateur et du système avec ce thème.

### Modified Capabilities
<!-- Aucune : aucune spec existante ne couvre le thème. -->

## Impact

- `src/components/site/SiteShell.tsx` : `siteViewport.themeColor` devient une seule couleur sombre ; le script de démarrage `themeBootScript` met à jour la balise `<meta name="theme-color">`.
- `src/lib/preferences.ts` : couleurs des barres par thème, et `applyTheme` met à jour la balise `theme-color`. `PreferencesProvider` l'appelle déjà au changement et à la réinitialisation.
- Tests unitaires : nouveau `tests/unit/theme-color.test.ts`.
- Aucune dépendance, API ou donnée en base touchée.
