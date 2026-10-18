# Tasks

## 1. Couleur des barres pilotée par le thème (client)

- [x] 1.1 Ajouter `THEME_CHROME_COLORS` (`dark: "#07080d"`, `light: "#e8eef6"`) dans `src/lib/preferences.ts`, plus une fonction pure qui, pour un `Document` et un thème, garde une seule `<meta name="theme-color">` (sans attribut `media`) et règle son `content`. Vérifier avec `tests/unit/theme-color.test.ts` (document simulé) : balise créée si absente, doublons et variantes `media` supprimés, couleur sombre et claire correctes.
- [x] 1.2 Appeler cette fonction depuis `applyTheme()` et vérifier dans le test que `applyTheme("light")` puis `applyTheme("dark")` font passer la balise de `#e8eef6` à `#07080d`. `npm run test:unit` passe.

## 2. Premier affichage (serveur + script de démarrage)

- [x] 2.1 Dans `src/components/site/SiteShell.tsx`, remplacer les deux `themeColor` à `media` par `themeColor: THEME_CHROME_COLORS.dark`. Vérifier dans le test unitaire que `siteViewport.themeColor` vaut `"#07080d"`, sans variante `prefers-color-scheme`.
- [x] 2.2 Étendre `themeBootScript` : supprimer les `meta[name=theme-color]` existantes, en créer une avec la couleur du thème lu (couleurs injectées depuis `THEME_CHROME_COLORS` via `JSON.stringify`), sombre par défaut ou en cas d'erreur. Vérifier avec `npm run lint` et `npx tsc --noEmit`.
- [x] 2.3 Lancer `npm run dev`, ouvrir `/fr` et vérifier dans le HTML rendu et dans le DOM après chargement qu'il n'y a qu'une seule `<meta name="theme-color">` : `#07080d` sans préférence enregistrée, `#e8eef6` après avoir mis `theme: "light"` dans `cptcg-preferences` puis rechargé.

## 3. Vérification sur appareil

- [ ] 3.1 Sur un téléphone Android en thème **clair** : vérifier que la barre d'état du haut et la barre système du bas sont noires avec l'app en thème sombre, puis claires après passage au thème clair dans les réglages (sans recharger), puis noires après réinitialisation des préférences. Tester dans Chrome et dans l'appli installée. Si la barre du bas de l'appli installée reste blanche, le noter et le signaler à l'utilisateur (piste manifeste, cf. design.md, Risques), sans remettre le manifeste dans ce changement.

## Workflow follow-up

- Archiver le changement (`/opsx:archive`) une fois la vérification sur appareil faite.
