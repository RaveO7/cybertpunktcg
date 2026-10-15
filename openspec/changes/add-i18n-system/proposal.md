# Proposal

## Why

Le site parle cinq langues (français, anglais, allemand, espagnol, italien), mais les traductions sont éparpillées dans trois systèmes maison : un fichier `messages.ts` de 5 140 lignes pour l'application, `seo/copy.ts` pour les pages publiques, et `src/lib/rules/*` pour les règles et le tutoriel (français et anglais seulement). Chaque langue des pages publiques est servie par une arborescence de routes recopiée (`(en)`, `(de)`, `(es)`, `(it)` : une trentaine de fichiers identiques au code de langue près), la langue de l'application dépend du `localStorage` (donc invisible pour le serveur, avec un rendu dans la mauvaise langue avant l'hydratation), et une dizaine de composants testent la langue en dur (`locale === "fr" ? … : …`). Ajouter un bloc de texte oblige à éditer cinq gros objets à la main ; ajouter une langue oblige à recopier des routes et à toucher une quinzaine de fichiers. Il faut un système unique, standard pour Next.js, où ajouter, modifier ou supprimer un bloc de texte et ajouter une langue soient des opérations simples et vérifiées.

## What Changes

- **Bibliothèque `next-intl`** : remplace `LocaleProvider`, `messages.ts`, `seo/copy.ts` et les sélecteurs `locale === "fr"`. Les textes passent au format ICU (variables, pluriels) et sont lus côté serveur comme côté client.
- **Traductions en fichiers JSON par langue et par bloc** : `src/i18n/messages/<langue>/<bloc>.json` (un bloc = une zone de l'interface : navigation, accueil, catalogue, tournois, paramètres, règles…). Le français est la langue de référence : les types des clés en découlent, et un test vérifie que chaque langue a exactement les mêmes clés et des messages ICU valides.
- **Registre unique des langues** (`src/i18n/config.ts`) : code, nom affiché, format régional, locale Open Graph, segments d'URL traduits. Ajouter une langue = une entrée dans ce registre + un dossier de traductions ; aucune route à créer.
- **Une seule arborescence de routes `app/[locale]/…`** pour tout le site (pages publiques et application) ; suppression des groupes `(fr)`, `(en)`, `(de)`, `(es)`, `(it)`. **Chaque langue a son préfixe, français compris** (`/fr/cartes`, `/en/cards`, `/de/karten`, `/it/carte`…) : `next-intl` gère les préfixes et les segments traduits. **BREAKING (URL)** : les adresses sans préfixe sont redirigées de façon permanente (308) vers la même page en anglais (`/en/…`).
- **Langue de l'application dans l'URL** : un utilisateur qui a choisi l'allemand utilise `/de/decks`, `/de/parametres`… La page est rendue directement dans sa langue par le serveur. **BREAKING (URL)** : les écrans de l'application dans une autre langue que le français prennent un préfixe (`/de/decks` au lieu de `/decks` + `localStorage`). Les écrans français passent sous `/fr` (`/fr/decks`).
- **Préférence de langue dans un cookie** (au lieu du `localStorage`), lue par le serveur et le proxy ; reprise automatique de l'ancienne préférence enregistrée.
- **Traductions complètes en allemand, espagnol et italien** de tout ce qui n'existe aujourd'hui qu'en français et en anglais : règles, tutoriel, partie guidée, anatomie de carte, exemples de cartes.
- **Texte de règles des cartes traduit** en allemand, espagnol et italien (les noms de cartes restent en anglais), avec repli sur l'anglais si le texte de la carte change dans la base.
- **Pages légales traduites** dans les cinq langues, avec des URL par langue ; la version française reste celle qui fait foi et l'indique.
- **Formats régionaux unifiés** (dates, prix, nombres) via le formateur de `next-intl` et le format régional du registre.

**Hors périmètre** : traduction des noms de cartes ; traduction des données saisies par les utilisateurs (descriptions de boutiques, noms de tournois) ; enregistrement de la langue dans le compte utilisateur en base (le cookie suffit) ; plateforme de traduction externe (Crowdin, Tolgee) ; traduction des segments d'URL des écrans privés de l'application (gardent leurs noms actuels, possible plus tard par configuration).

## Capabilities

### New Capabilities
- `i18n/languages`: registre des langues prises en charge, langue par défaut, ajout d'une langue, repli quand une traduction manque, choix et mémorisation de la langue de l'utilisateur.
- `i18n/translations`: organisation des textes en blocs par langue, cohérence des clés entre langues, messages avec variables et pluriels, formats régionaux, couverture de tout le site (application, pages publiques, règles, pages légales, texte de règles des cartes).

### Modified Capabilities
- `seo/localization`: passage de deux à cinq langues indexables (URL par langue avec segments traduits, `hreflang` des cinq versions, sélecteur listant toutes les langues, suggestion de la langue du visiteur, redirection des utilisateurs connectés vers leur langue) et langue de l'application portée par l'URL. Capacité introduite par le change `optimize-seo`, à archiver avant celui-ci.
- `catalog/public-cards`: le texte de règles des fiches de carte s'affiche dans la langue de la page quand une traduction existe. Capacité introduite par `optimize-seo`.

## Impact

- **Dépendance** : ajout de `next-intl` (v4, compatible Next 16 et React 19).
- **Routage** (`src/app/`) : déplacement de toutes les pages sous `app/[locale]/`, une seule mise en page racine ; suppression des groupes `(fr)`, `(en)`, `(de)`, `(es)`, `(it)` ; `global-not-found.tsx` conservé.
- **Proxy** (`src/proxy.ts`) : composition du proxy `next-intl` (préfixes, segments traduits) avec les règles existantes (annuaires réservés aux comptes, cookie de pays, redirection des comptes vers leur langue).
- **Code supprimé ou remplacé** : `src/lib/i18n/messages.ts`, `src/lib/seo/copy.ts`, `src/components/LocaleProvider.tsx`, `src/lib/seo/routes.ts` (remplacé par la configuration de routage `next-intl`), les contenus `src/lib/rules/{howto-play,tutorial,demo-match,card-anatomy}.ts` (textes déplacés en JSON), `useLocalizedHref`.
- **Composants** : les 48 composants qui utilisent `useI18n` passent à `useTranslations` / `getTranslations` ; liens internes via la navigation `next-intl` ; `Header` (sélecteur), `LanguageSuggestion`, `PreferredLanguageRedirect`, `Footer`, pages légales.
- **SEO** : `metadata.ts`, `sitemap.ts`, `structured-data.ts`, images de partage `/og/[locale]` : alimentés par le registre des langues ; les URL indexées existantes sont conservées.
- **Tests** : tests unitaires `seo-*`, `geo-locale`, `seo-locale` adaptés ; nouveaux tests de parité des clés et de validité ICU ; tests base de données du sitemap et des métadonnées.
- **Volume de traduction** : environ 3 000 lignes de règles et de tutoriel, 150 textes de règles de cartes et trois pages légales, à traduire en allemand, espagnol et italien (et pages légales en anglais).
