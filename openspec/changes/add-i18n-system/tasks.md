# Tasks

## 1. Prérequis et socle next-intl

- [x] 1.1 Archiver le change `optimize-seo` (34/34 tâches) avec `openspec archive optimize-seo` ; vérifier que `openspec list --specs` liste `seo/localization` et `catalog/public-cards`, et que `openspec validate add-i18n-system` n'émet plus l'avertissement « target spec does not exist »
- [x] 1.2 Installer `next-intl` (v4) ; vérifier `npm ls next-intl` et que `npm run build` passe sans autre changement
- [x] 1.3 Créer le registre `src/i18n/config.ts` (langues fr, en, de, es, it : code, nom affiché, format régional, locale Open Graph, pays associés ; français par défaut) et y rattacher `LOCALES`, `intlLocale`, `OG_LOCALE` et les listes de pays de `geo-locale.ts` ; vérifier `npm run typecheck` et les tests `geo-locale` existants
- [x] 1.4 Créer `src/i18n/routing.ts` (`defineRouting` : langues du registre, `localePrefix: "as-needed"`, `localeDetection: false`, `pathnames` du design §4 dont l'explorateur `/cards` → `/explorer`, et toutes les autres routes de l'application déclarées à l'identique) et `src/i18n/navigation.ts` (`createNavigation`) ; test unitaire qui vérifie pour chaque route publique et légale l'URL de chaque langue avec `getPathname` (mêmes URL que le tableau de la spec `seo/localization`)
- [x] 1.5 Créer `src/i18n/request.ts` (chargement des blocs de la langue, fusion profonde sur `en` puis `fr`, `onError`/`getMessageFallback` qui journalisent les clés manquantes en développement) et déclarer les types `AppConfig` (`Locale`, `Messages` dérivé de `src/i18n/messages/fr/index.ts`) ; test unitaire du repli : une clé absente en italien renvoie l'anglais, absente partout sauf en français renvoie le français

## 2. Extraction des textes en JSON

- [x] 2.1 Écrire un script ponctuel (dans le scratchpad, non commité) qui exporte `messages.ts` et `copy.ts` en blocs JSON par langue sous `src/i18n/messages/<langue>/` ; convertir à la main les 189 messages-fonctions en messages ICU (variables, `plural`, `select`) ; vérifier que chaque bloc est un JSON valide et que `fr/index.ts` importe tous les blocs français
- [x] 2.2 Ajouter le test de parité `tests/unit/i18n-messages.test.ts` : mêmes fichiers et mêmes clés que `fr` pour chaque langue du registre, messages ICU analysables, mêmes variables que la référence, `pathnames` définis pour chaque langue ; vérifier qu'il passe, puis qu'il échoue si l'on retire une clé d'un bloc allemand (contrôle manuel, retour arrière ensuite)
- [x] 2.3 Documenter dans `src/i18n/README.md` les opérations courantes : modifier un texte, ajouter/supprimer une clé, ajouter un bloc, ajouter une langue (registre, dossier de traductions, `pathnames`), traduire le texte d'une carte, lancer les vérifications ; vérifier en suivant pas à pas la procédure « ajouter une clé » sur une clé de test (puis la retirer)

## 3. Arborescence unique `app/[locale]` et proxy

- [x] 3.1 Déplacer avec `git mv` le contenu de `src/app/(fr)/` vers `src/app/[locale]/` ; mise en page racine unique avec `generateStaticParams` (langues du registre), `setRequestLocale`, `<html lang={locale}>` et `NextIntlClientProvider` limité aux blocs clients communs (design §7) ; supprimer `(en)`, `(de)`, `(es)`, `(it)` ; vérifier `npm run build` et que les pages prérendues (fiches de cartes) existent pour les cinq langues
- [x] 3.2 Réécrire `src/proxy.ts` : gestionnaire `next-intl` d'abord, puis renvoi des visiteurs des annuaires réservés, cookie de pays, redirection des utilisateurs connectés vers leur langue (cookie de session + cookie `cptcg-locale`), redirection 308 des chemins techniques non traduits ; tests unitaires du proxy (requêtes simulées) : visiteur et robot jamais redirigés, utilisateur connecté germanophone redirigé de `/cartes/x` vers `/de/karten/x`, `/de/cards/x` → `/de/karten/x`, `/nl/cards` → 404
- [x] 3.3 Réécrire `localizedPath`, `alternatePath`, `languageAlternates` au-dessus de `getPathname` (même signature) et supprimer `src/lib/seo/routes.ts` ; adapter `metadata.ts`, `sitemap.ts`, `structured-data.ts`, `Breadcrumbs`, les routes `/og/*` ; vérifier les tests `seo-*` existants (adaptés aux nouvelles importations) et le test db `tests/db/seo.test.ts` (sitemap : cinq versions par page publique et légale, alternatives réciproques)
- [x] 3.4 Vérifier sur `npm run build && npm run start` (base SQLite locale) que chaque URL publique actuelle (accueil, `/cartes`, une fiche, un tournoi, une boutique, dans les cinq langues) répond 200 avec le même `<link rel="canonical">` et les mêmes `hreflang` qu'avant la refonte (liste relevée avant l'étape 3.1), et que `/decks` sert `lang="fr"` et `/de/decks` `lang="de"`

## 4. Migration des composants

- [x] 4.1 Ajouter un adaptateur temporaire `useI18n()` au-dessus de `next-intl` (langue, `setLocale`) pour migrer par lots sans casser l'application ; vérifier `npm run typecheck`
- [x] 4.2 Migrer les composants clients vers `useTranslations(bloc)` et les liens vers `Link`/`useRouter` de `src/i18n/navigation.ts`, par lots (navigation et pied de page ; collection et explorateur ; decks ; tournois ; boutiques ; paramètres et compte ; administration) ; après chaque lot : `npm run typecheck`, lint et `npm test`
- [x] 4.3 Migrer les pages et composants serveur publics (`Landing`, `catalog-pages`, `shop-pages`, `tournament-pages`, métadonnées) vers `getTranslations` et le formateur `next-intl` (dates, prix, nombres) ; vérifier le HTML servi de `/`, `/en`, `/it`, `/de/karten` (textes, `lang`, titre, description)
- [x] 4.4 Remplacer les 9 tests `locale === "fr" ? … : …` par des messages ou par le registre ; vérifier `grep -rn 'locale === "fr" ?' src` sans résultat
- [x] 4.5 Sélecteur de langue (`Header`) et paramètres : écrire le cookie `cptcg-locale` et naviguer vers la même page dans la langue choisie ; composant de reprise de l'ancienne préférence `localStorage` ; `LanguageSuggestion` et `PreferredLanguageRedirect` alimentés par le registre et le cookie ; tests unitaires de la suggestion (préférence, pays, navigateur, repli anglais) ; vérifier dans le navigateur qu'aucun bandeau n'apparaît pendant un changement de langue
- [x] 4.6 Supprimer `LocaleProvider`, l'adaptateur `useI18n`, `src/lib/i18n/messages.ts`, `src/lib/seo/copy.ts`, `useLocalizedHref` ; vérifier `grep -rn "useI18n\|seo/copy\|i18n/messages" src` sans résultat, `npm run typecheck`, lint et `npm test`

## 5. Règles, tutoriel et partie guidée dans les cinq langues

- [x] 5.1 Séparer données et textes de `howto-play`, `tutorial`, `demo-match`, `card-anatomy`, `examples` : identifiants, ordre et cartes d'exemple restent en TypeScript, textes FR/EN déplacés dans les blocs `rules/*.json` (fonctions converties en ICU), lus avec `t.raw()` ; transmettre ces blocs uniquement aux pages de règles (design §7) ; vérifier que `/comment-jouer` et `/en/comment-jouer` affichent les mêmes contenus qu'avant (comparaison du texte visible)
- [x] 5.2 Fixer un glossaire de termes de jeu par langue (Unité, Légende, Programme, Équipement, défausse, terrain, prêt/épuisé, Gig, RAM, rival, vaincre…) dans `src/i18n/GLOSSARY.md`, à partir de la version française officielle
- [x] 5.3 Traduire les blocs `rules/*.json` en allemand, espagnol et italien selon le glossaire (mots-clés `{…}` et affiliations en majuscules inchangés) ; vérifier le test de parité, un test qui contrôle la conservation des `{…}` et des majuscules, et l'affichage de `/de/comment-jouer`, `/es/comment-jouer`, `/it/comment-jouer` (parcours et partie guidée jouables de bout en bout)

## 6. Texte de règles des cartes

- [x] 6.1 Créer `src/i18n/cards/{de,es,it}.json` (`{ slug: { source, text } }`) et brancher `publicCards` : traduction utilisée seulement si `source` est égal au `rulesText` anglais actuel, sinon anglais + mention sur la fiche ; tests unitaires sur les données de test (traduction à jour, périmée, absente)
- [x] 6.2 Exporter en lecture seule les 150 textes de règles de `data/collection.db` et les traduire en allemand, espagnol et italien selon le glossaire (référence de style : impressions françaises officielles) ; vérifier avec un test que chaque traduction conserve les `{…}`, les affiliations en majuscules et les nombres de la source
- [x] 6.3 Créer `scripts/check-card-translations.ts` (lecture seule, aucune écriture en base) qui liste les cartes sans traduction ou avec une traduction périmée par langue ; vérifier qu'il rapporte 0 manque sur la base locale, puis un manque après modification d'une copie de `data/collection.db` (copie supprimée à la fin, cf. `tests/db/history-cache.test.ts`)
- [x] 6.4 Vérifier sur `/de/karten/<slug>`, `/es/cartas/<slug>`, `/it/carte/<slug>` : nom anglais, texte de règles traduit, description de la page (meta) dans la langue, dialogue de l'éventail de l'accueil traduit

## 7. Pages légales dans les cinq langues

- [x] 7.1 Extraire le texte des trois pages légales dans le bloc `legal.json` (sections, paragraphes, listes, liens en texte riche) et rendre les pages par `LegalPage` ; vérifier que les pages françaises affichent exactement le même texte qu'avant (comparaison du texte visible)
- [x] 7.2 Traduire `legal.json` en anglais, allemand, espagnol et italien, avec la mention « la version française fait foi » et son lien ; ajouter les pages légales au sitemap avec leurs cinq versions ; vérifier les URL de chaque version (200, `lang`, `hreflang`), le lien du pied de page dans chaque langue et le test db du sitemap

## 8. Vérification d'ensemble

- [x] 8.1 `npm run typecheck`, lint, `npm test` (unitaires et db, sur SQLite locale, données de test nettoyées) et `npm run build` sans erreur
- [x] 8.2 Parcours dans le navigateur : visiteur sur `/` → sélecteur « Italiano » → `/it` → liste des cartes → fiche → inscription en italien ; utilisateur connecté qui choisit l'allemand dans les paramètres → `/de/decks`, puis ouverture de `/cartes/x` → `/de/karten/x` ; aucun texte français résiduel sur les pages italiennes et allemandes (recherche des mots les plus fréquents du bloc français dans le HTML servi)
- [x] 8.3 Mesurer la taille du HTML et du JavaScript de `/`, `/it/carte/<slug>` et `/de/comment-jouer` avant et après la refonte ; vérifier que les pages publiques ne transportent pas les blocs de règles

## Workflow follow-up

- Faire relire les traductions allemandes, espagnoles et italiennes (règles, cartes, pages légales) par des locuteurs natifs avant la mise en ligne.
- Archiver le change après revue.
