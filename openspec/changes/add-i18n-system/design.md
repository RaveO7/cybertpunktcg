# Design

## Context

Voir proposal.md (Why) pour la motivation. État actuel qui contraint l'approche :

- **Routes** : `src/app/(fr)` contient 26 pages (application + pages publiques françaises) avec sa propre mise en page racine ; `(en)`, `(de)`, `(es)`, `(it)` recopient les 5 pages publiques et leur mise en page. Les noms de dossiers de l'application sont français (`parametres`, `souhaits`, `tournois`…).
- **Langue** : `LocaleProvider` (client) lit la préférence dans `localStorage` et la langue imposée par l'URL via `src/lib/seo/routes.ts` ; le serveur ne connaît pas la langue des écrans de l'application, qui se rendent d'abord en français.
- **Textes** : `src/lib/i18n/messages.ts` (5 140 lignes, 5 langues, 134 messages sous forme de fonctions), `src/lib/seo/copy.ts` (5 langues, 55 fonctions), `src/lib/rules/{howto-play,tutorial,demo-match,card-anatomy}.ts` (FR/EN, structures imbriquées, 71 fonctions) ; pages légales écrites en JSX français.
- **Proxy** (`src/proxy.ts`, Next 16) : renvoie les visiteurs des annuaires réservés aux comptes vers l'accueil et pose le cookie de pays (`x-vercel-ip-country`).
- **Préférence utilisateur** : aucune colonne de langue sur `User` ; seulement `localStorage` (`cptcg-locale`).
- **Conflit d'URL** : l'explorateur de cartes de l'application est à `/cards` ; la liste publique anglaise est à `/en/cards`. Si la langue de l'application passe dans l'URL, l'explorateur anglais ne peut pas être `/en/cards`.
- Le travail non commité de cette session (groupes `(de)`, `(es)`, `(it)`, traductions ajoutées dans `copy.ts`, sélecteur de langue) est repris : ses textes migrent en JSON, ses routes recopiées disparaissent.

## Goals / Non-Goals

**Goals:**
- Un seul endroit par préoccupation : registre des langues, configuration des URL, un fichier de textes par bloc et par langue.
- Rendu serveur dans la bonne langue sur toutes les pages (aucun texte qui change après l'hydratation).
- URL publiques indexées actuelles strictement conservées.
- Erreurs de traduction détectées par TypeScript et par les tests, pas en production.

**Non-Goals:**
- Traduire les segments d'URL des écrans privés de l'application (configuration possible plus tard, sans changement de code).
- Charger les traductions à la demande côté client par bloc au-delà du découpage décrit ci-dessous.
- Outil d'édition des traductions en ligne.

## Decisions

### 1. `next-intl` plutôt que le système maison
`next-intl` (v4, compatible Next 16 / React 19) fournit le routage par langue (préfixe facultatif pour la langue par défaut, segments d'URL traduits), le chargement des textes côté serveur et client, le format ICU (variables, pluriels propres à chaque langue), le formatage régional et le typage des clés.
- *Alternative* : arborescence `app/[lang]` + dictionnaires TypeScript maison (approche du guide Next.js). Écartée : il faudrait réécrire nous-mêmes la négociation du préfixe facultatif, les segments traduits, les pluriels et les liens localisés, déjà fournis et maintenus par `next-intl`.

### 2. Registre des langues unique
`src/i18n/config.ts` déclare chaque langue : code, nom affiché, format régional (`fr-FR`…), locale Open Graph (`fr_FR`…), et liste des pays où elle est proposée. Tout le reste en dérive : configuration de routage, sélecteur, `hreflang`, sitemap, images de partage, suggestion de langue. Ajouter une langue = une entrée ici + un dossier de traductions + ses segments d'URL dans la configuration de routage (décision 4). Un test vérifie que chaque langue déclarée a ses traductions et ses segments.

### 3. Textes en JSON, un fichier par bloc et par langue
```
src/i18n/messages/
  fr/  index.ts  common.json  nav.json  landing.json  catalog.json  card.json
       tournaments.json  shops.json  decks.json  settings.json  legal.json
       rules/howToPlay.json  rules/tutorial.json  rules/demoMatch.json  rules/anatomy.json  …
  en/  …mêmes fichiers…
  de/  es/  it/
```
- Le découpage en blocs suit les zones de l'interface (les clés de premier niveau actuelles de `messages.ts` et `copy.ts`, et un bloc par contenu de règles).
- `fr/index.ts` importe statiquement les blocs français : c'est la **référence** dont TypeScript dérive le type des messages (`AppConfig.Messages` de `next-intl`). Ajouter un bloc = un fichier JSON par langue + une ligne d'import dans `fr/index.ts`.
- Le chargement côté serveur (`src/i18n/request.ts`) lit les blocs de la langue demandée et les fusionne en profondeur sur l'anglais puis le français (décision 8).
- Les 260 messages-fonctions actuels deviennent des messages ICU (`"{count, plural, one {# carte} other {# cartes}}"`) ; leurs appels passent à `t("clé", { count })`.
- Les contenus structurés (étapes, zones, mots-clés des règles) restent des tableaux d'objets en JSON, lus avec `t.raw()` ; les données non traduisibles (identifiants de zone, carte d'exemple associée, ordre) restent en TypeScript dans `src/lib/rules/` et sont associées aux textes par identifiant.
- *Alternative* : un seul fichier JSON par langue. Écartée : des fichiers de plusieurs milliers de lignes rendent les ajouts et les relectures difficiles. *Alternative* : garder des objets TypeScript. Écartée : le JSON est le format attendu par `next-intl`, par les outils de traduction et par un éventuel traducteur non développeur.

### 4. Routage : une seule arborescence `app/[locale]`, dossiers aux noms français
- Toutes les pages passent sous `src/app/[locale]/` avec une seule mise en page racine (`<html lang={locale}>`, `generateStaticParams` sur les langues du registre, `setRequestLocale` pour le rendu statique). Les dossiers gardent leurs noms français actuels : `src/app/(fr)/*` devient `src/app/[locale]/*` presque tel quel, et les URL françaises ne changent pas.
- `src/i18n/routing.ts` (`defineRouting`) : `localePrefix: "as-needed"` (français sans préfixe), `localeDetection: false` (aucune redirection automatique des visiteurs ni des robots), et `pathnames` pour les routes dont l'URL diffère selon la langue :
  - `/cartes`, `/cartes/[slug]` → `/cards`, `/karten`, `/cartas`, `/carte` ;
  - `/tournois/publics/[id]` → `/tournaments/[id]`, `/turniere/[id]`, `/torneos/[id]`, `/tornei/[id]` ;
  - `/boutiques/[slug]` → `/shops/[slug]`, `/shops/[slug]`, `/tiendas/[slug]`, `/negozi/[slug]` ;
  - pages légales : `/mentions-legales` → `/legal-notice`, `/impressum`, `/aviso-legal`, `/note-legali` ; `/cgu` → `/terms`, `/nutzungsbedingungen`, `/condiciones`, `/termini` ; `/confidentialite` → `/privacy`, `/datenschutz`, `/privacidad`, `/privacy` ;
  - **explorateur de cartes** `/cards` → `/explorer` dans les autres langues, pour libérer `/en/cards` (liste publique) ;
  - les autres écrans sont déclarés à l'identique (`/decks` → `/de/decks`), ce qui donne des liens typés pour toutes les routes.
- Les groupes `(en)`, `(de)`, `(es)`, `(it)` et `src/lib/seo/routes.ts` sont supprimés ; `localizedPath`, `alternatePath` et `languageAlternates` sont réécrits au-dessus de `getPathname` de `next-intl`, avec la même signature pour limiter les changements dans le code SEO.
- `src/app/api`, `src/app/og`, `sitemap.ts`, `robots.ts`, `manifest.ts` et `global-not-found.tsx` restent hors de `[locale]`.
- *Alternative* : dossiers aux noms anglais (`app/[locale]/cards/[slug]`). Écartée : obligerait à déclarer une traduction française de chaque écran de l'application et à renommer 26 dossiers, sans bénéfice.

### 5. Proxy : composition avec `next-intl`
`src/proxy.ts` appelle d'abord le gestionnaire `next-intl` (réécriture des URL traduites, préfixes, 404 des langues inconnues), puis applique sur sa réponse les règles existantes : renvoi des visiteurs sans compte depuis les annuaires réservés, cookie de pays, et **redirection des utilisateurs connectés** vers la page dans leur langue (cookie de session + cookie de préférence différent de la langue de l'URL). Les visiteurs et les robots ne sont jamais redirigés. Le proxy redirige aussi (308) les chemins techniques non traduits (`/de/cards/x`) vers l'URL publique, pour éviter le contenu dupliqué ; `next-intl` le fait pour les `pathnames` déclarés.

### 6. Préférence dans un cookie
La préférence passe dans un cookie (`cptcg-locale`, 1 an, `SameSite=Lax`), écrit par le sélecteur et les paramètres, lu par le proxy (décision 5) et par la suggestion de langue. Au premier chargement, un petit composant client recopie l'ancienne valeur du `localStorage` dans le cookie (puis redirige un utilisateur connecté si besoin), et la valeur du `localStorage` est ensuite ignorée. L'exigence « Langue de la dernière page publique » (spec `i18n/languages`) est satisfaite par le routage, sans stockage : l'écran de connexion est lui aussi sous `[locale]`, et les liens d'une page publique y mènent dans la même langue (`/de` → `/de/connexion`). Le stockage de session ajouté plus tôt dans `LocaleProvider` disparaît avec lui.
- *Alternative* : colonne `locale` sur `User`. Écartée pour ce change (migration Prisma sur la base de production, non nécessaire pour les exigences) ; possible ensuite pour retrouver la langue sur un nouvel appareil.

### 7. Messages envoyés au client
`NextIntlClientProvider` dans la mise en page racine ne transmet que les blocs utilisés par les composants clients communs (navigation, commun, application). Les blocs volumineux (règles, tutoriel, partie guidée, pages légales, accueil) sont transmis par un fournisseur imbriqué dans la mise en page de leurs pages seulement, ou lus côté serveur. Cela évite d'envoyer les ~3 000 lignes de règles à chaque page.

### 8. Repli et contrôle des traductions
- Repli à l'exécution : fusion profonde `fr` ← `en` ← langue demandée, avec `onError`/`getMessageFallback` qui journalisent la clé manquante en développement.
- Test de parité (`tests/unit/i18n-messages.test.ts`) : pour chaque langue du registre, mêmes fichiers et mêmes clés que `fr`, messages ICU analysables, mêmes noms de variables que la référence, et présence des `pathnames` de chaque langue.
- Les composants n'utilisent plus `locale === "fr"` : toute variation par langue passe par un message ou par le registre (`intl`, `ogLocale`).

### 9. Texte de règles des cartes
Données, pas interface : `src/i18n/cards/<langue>.json` contient, par slug de carte, `{ "source": "<texte anglais traduit>", "text": "<traduction>" }`. Le catalogue public (`publicCards`) utilise la traduction seulement si `source` est identique au `rulesText` anglais actuel de la carte ; sinon il affiche l'anglais et la fiche le signale. Un script (`scripts/check-card-translations.ts`, lecture seule) liste les cartes sans traduction ou avec une traduction périmée ; un test unitaire fait la même vérification sur les données de test. Les mots-clés `{…}` et les affiliations en majuscules sont conservés (vérifié par le test).

### 10. Pages légales
Le texte de chaque page devient un bloc `legal.json` (sections, paragraphes, listes, avec balises riches pour les liens via `t.rich`), rendu par le gabarit `LegalPage` existant. La version française fait foi : les autres versions affichent une mention avec lien vers la page française (message du bloc). `FRENCH_ONLY_PATHS` disparaît ; les pages légales entrent dans le sitemap avec leurs cinq versions.

## Risks / Trade-offs

- [Refonte large : 48 composants, 26 pages, proxy, SEO] → Migration par étapes, chacune vérifiée par `tsc`, le lint et les tests ; pas de mélange ancien/nouveau système au-delà d'une étape (adaptateur temporaire `useI18n` → `useTranslations` pendant la migration des composants, supprimé à la fin).
- [Perte d'URL indexées ou de `hreflang`] → Test qui vérifie, pour chaque URL publique actuelle (accueil, liste et fiches de cartes, tournoi, boutique, dans les cinq langues), le statut 200, l'URL canonique et les alternatives ; contrôle du sitemap avant et après.
- [Écarts d'hydratation avec les URL réécrites] → `usePathname` de `next-intl` renvoie le chemin interne de façon identique au serveur et au client ; plus de déduction de la langue depuis l'URL côté client.
- [Poids des messages côté client] → Découpage décrit en décision 7 ; mesure de la taille des pages publiques avant et après.
- [Qualité des traductions de/es/it (règles, cartes, légal)] → Glossaire de termes de jeu fixé par langue avant traduction, en s'appuyant sur la version française officielle ; relecture par un locuteur natif recommandée avant mise en ligne, en particulier pour les pages légales.
- [Changement d'URL des écrans de l'application hors français] → Écrans en `noindex`, donc sans impact SEO ; les anciens liens sans préfixe restent valides (affichage en français ou redirection d'un utilisateur connecté vers sa langue).
- [Préférences existantes en `localStorage`] → Reprise automatique au premier chargement (décision 6).

## Migration Plan

1. Archiver le change `optimize-seo` (terminé) pour que les specs `seo/localization` et `catalog/public-cards` existent avant l'archivage de ce change.
2. Installer `next-intl`, créer registre, routage, chargement des messages et types ; extraire les textes existants en JSON (script d'extraction ponctuel depuis `messages.ts` et `copy.ts`, conversion des fonctions en ICU), sans changer l'affichage.
3. Déplacer les pages sous `app/[locale]`, brancher le proxy, supprimer les groupes recopiés ; vérifier les URL publiques.
4. Migrer les composants vers `useTranslations` / `getTranslations` et la navigation localisée ; supprimer `LocaleProvider`, `messages.ts`, `copy.ts`, `routes.ts`.
5. Traduire règles, tutoriel, partie guidée, anatomie, pages légales et texte des cartes.
6. Déployer : aucune migration de base ; rollback = revenir au commit précédent (le cookie de préférence est simplement ignoré par l'ancienne version, et le `localStorage` n'a pas été effacé).

## Open Questions

- Relecteurs natifs disponibles pour l'allemand, l'espagnol et l'italien avant la mise en ligne (n'affecte ni l'architecture ni les tâches : la relecture modifie seulement les fichiers JSON).
