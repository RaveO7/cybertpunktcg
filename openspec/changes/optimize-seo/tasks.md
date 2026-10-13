# Tasks

## 1. Deux mises en page racines (sans changement de comportement)

- [x] 1.1 Extraire le contenu de `src/app/layout.tsx` (polices, script de thème, fournisseurs, `AppFrame`, analytics) dans un composant serveur `SiteShell({ lang, children })` ; vérifier `npm run typecheck`
- [x] 1.2 Déplacer avec `git mv` toutes les routes de page (tout sauf `api/`, `manifest.ts`, `globals.css`) dans `src/app/(fr)/` avec un `layout.tsx` qui rend `SiteShell lang="fr"` ; vérifier que `npm run build` liste les mêmes URL qu'avant et que `npm test` passe
- [x] 1.3 Créer `src/app/(en)/layout.tsx` (`SiteShell lang="en"`) et une page `src/app/(en)/en/page.tsx` provisoire ; vérifier que `/en` sert `<html lang="en">` et `/` `<html lang="fr">`
- [x] 1.4 Activer `experimental.globalNotFound` et ajouter `src/app/global-not-found.tsx` autonome (styles, polices, thème sombre, lien vers l'accueil) ; garder un `not-found.tsx` dans chaque groupe et retirer le `loading.tsx` racine (il faisait streamer toutes les pages : `notFound()` répondait 200) ; vérifier qu'une URL inconnue et un `notFound()` de fiche renvoient 404 avec la page stylée

## 2. Fondations SEO : URL du site, marque, routes localisées

- [x] 2.1 Créer `src/lib/seo/site.ts` (`siteUrl()` avec repli `APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → localhost, `isProductionDeployment()`) et des tests unitaires de chaque repli
- [x] 2.2 Unifier la marque « TCG Tracker » : `SITE.name`, `metadata` des racines (`applicationName`, `appleWebApp.title`, `title.template: "%s · TCG Tracker"`, `metadataBase`), `manifest.ts` (`name`, `short_name`, `description`), titres existants des pages légales, boutiques et tournois ; vérifier par `grep -r "Collection Cyberpunk TCG" src` (aucun résultat) et le manifest servi
- [x] 2.3 Créer `src/lib/seo/routes.ts` (table des 8 pages bilingues + pages FR seules, `localizedPath`, `routeOfPath`, `alternatePath` qui conserve la query, `languageAlternates` avec `x-default` = FR) et des tests unitaires couvrant chaque correspondance, les paramètres dynamiques, la query et les chemins non localisés
- [x] 2.4 Créer `src/lib/seo/metadata.ts` (`pageMetadata` : titre, description tronquée à 160 sur une limite de mot, canonique sans query, `alternates.languages`, Open Graph `siteName`/`locale`/`type`/`images`, Twitter `summary_large_image` ; `privateMetadata` `noindex, nofollow`) et des tests unitaires (troncature, canonique d'une URL filtrée, alternatives absentes pour une page FR seule)

## 3. Langue imposée par l'URL

- [x] 3.1 Modifier `LocaleProvider` : langue de la route si `routeOfPath(usePathname())` est localisé, sinon `localStorage` ; `setLocale` sur une page localisée enregistre la préférence puis navigue vers `alternatePath` ; vérifier par un test de composant (ou unitaire de la fonction de choix) les cas URL FR + préférence EN, URL EN, page d'application + préférence IT
- [x] 3.2 Ajouter `useLocalizedHref()` et l'utiliser pour les liens publics de `Header`, `Footer`, `PublicDirectory`, `PublicTournamentPage`, `ShopDirectory`, `ShopPage` ; vérifier qu'en `/en/tournaments/<id>` le lien boutique pointe vers `/en/shops/<slug>` et que les liens légaux restent en FR
- [x] 3.3 Ajouter le sélecteur de langue FR/EN des pages publiques (lien vers l'URL équivalente) et le bandeau de suggestion « English version » (préférence ou `navigator.language` ≠ fr, refus mémorisé, rendu après montage) ; vérifier que le HTML serveur contient le sélecteur mais pas le bandeau (affichage du bandeau dans le navigateur : cf. suivi)
- [x] 3.4 Ajouter les textes nouveaux : navigation visiteur et lien catalogue de l'écran de connexion dans `src/lib/i18n/messages.ts` (5 langues, partagés avec l'application) ; textes des pages publiques rendues côté serveur (landing, catalogue, fiches, fil d'Ariane, métadonnées, images de partage) dans `src/lib/seo/copy.ts` (FR et EN, seules langues de ces pages) ; vérifier `npm run typecheck`

## 4. Exploration et exclusions

- [x] 4.1 Créer `src/app/robots.ts` (production : interdit `/api/` et `/admin` sauf les logos de boutique `/api/shops/*/logo`, déclare le sitemap ; sinon interdit tout) et un test unitaire des deux cas
- [x] 4.2 Exporter `privateMetadata` sur toutes les pages privées ou à jeton listées dans le design (§12), plus le lien vers `/cartes` sur `/cards` pour les visiteurs ; vérifier avec `curl` sur `npm run start` que chacune sert `<meta name="robots" content="noindex, nofollow">`
- [x] 4.3 Ajouter `noindex` à la fiche d'un tournoi public annulé et vérifier qu'une réponse `notFound()` porte `noindex` ; test db qui crée un tournoi public annulé (nettoyé dans `finally`) et contrôle les métadonnées générées
- [x] 4.4 Créer `src/lib/seo/sitemap.ts` (construction des entrées : pages statiques, cartes, boutiques non refusées, tournois publics non annulés futurs ou < 180 jours, `lastModified` réel, alternatives de langue) et `src/app/sitemap.ts` (revalidation 3600) ; test db qui crée une boutique en attente, une boutique refusée, un tournoi privé, un public annulé et un public à venir (comptes `@example.com`, suppression dans `finally`) et vérifie la présence ou l'absence de chacun

## 5. Données structurées

- [x] 5.1 Créer le composant `JsonLd` (échappement de `<`) et `src/lib/seo/structured-data.ts` (`websiteLd`, `organizationLd`, `breadcrumbLd`, `eventLd`, `storeLd`, `itemListLd`, `cardLd`) avec tests unitaires : nom piégé `</script>`, tournoi complet → `SoldOut`, gratuit → prix 0, annulé → `EventCancelled`, boutique sans horaires, `sameAs` absent si aucun réseau, illustrateur absent
- [x] 5.2 Ajouter un composant `Breadcrumbs` visible alimenté par les mêmes données que `breadcrumbLd` ; vérifier son rendu sur une fiche

## 6. Tournois publics et boutiques : versions anglaises et SEO

- [x] 6.1 Refactorer `tournois/publics/page.tsx` et `[id]/page.tsx` en modules partagés paramétrés par la langue ; créer `/en/tournaments` et `/en/tournaments/[id]` ; vérifier qu'une même fiche s'ouvre dans les deux langues avec les filtres conservés
- [x] 6.2 Brancher `pageMetadata` (titres, descriptions, canonique, hreflang), `Breadcrumbs`, `eventLd` sur les fiches et `itemListLd` sur l'annuaire ; vérifier le JSON-LD d'une fiche servie (données de test supprimées ensuite) ; Rich Results Test sur une URL publique : cf. suivi
- [x] 6.3 Faire de même pour `/boutiques`, `/boutiques/[slug]`, `/en/shops`, `/en/shops/[slug]` avec `storeLd` et `itemListLd` des tournois à venir ; vérifier le JSON-LD d'une boutique avec et sans logo/horaires
- [x] 6.4 Ajouter les images de partage générées (route `/og/[locale]` par défaut, `/og/tournament/[id]/[locale]`, `/og/shop/[slug]/[locale]`, référencées explicitement par `pageMetadata`) ; vérifier les images servies (PNG 1200×630) en ouvrant leurs URL ; débogueur Open Graph sur une URL publique : cf. suivi

## 7. Catalogue public de cartes

- [x] 7.1 Écrire les fonctions de lecture du catalogue public (cartes actives hors scellés, contenu FR/EN avec repli, prix le plus récent, voisines et cartes de même couleur) au-dessus de `loadCatalogCached()` avec tests unitaires (repli EN, exclusion des scellés, ordre précédent/suivant)
- [x] 7.2 Créer `/cartes` et `/en/cards` (composants serveur, grille avec miniatures, `alt`, filtres couleur/type en liens, `itemListLd`, canonique sans query) ; vérifier avec `curl` que le HTML contient les liens des 151 cartes de jeu sans JavaScript
- [x] 7.3 Créer `/cartes/[slug]` et `/en/cards/[slug]` (`generateStaticParams`, `dynamicParams`, `revalidate = 3600`, caractéristiques, impressions, prix daté, liens voisins et même couleur, `cardLd`, `Breadcrumbs`, image de la carte en Open Graph, 404 si slug inconnu) ; vérifier que `npm run build` les prérend et qu'un slug inconnu renvoie 404
- [x] 7.4 Bouton « Ajouter à ma collection » des fiches et du catalogue, en réutilisant le paramètre existant `?printing=<id>` de `CardsExplorer` (connecté → `/cards?printing=<id>`, visiteur → `/connexion?mode=register&next=…`) ; vérifier le lien visiteur dans le HTML serveur (parcours connecté dans le navigateur : cf. suivi)

## 8. Accueil public, connexion et tutoriel

- [x] 8.1 Créer la route `/connexion` (`AuthScreen`, `?mode=`, redirection vers `next` validé comme chemin relatif, `noindex`) avec un test unitaire de validation de `next` (refus de `//evil.com` et des URL absolues) ; les erreurs OAuth reviennent sur `/connexion` au lieu de `/`
- [x] 8.2 Créer la landing (composant serveur : `h1`, fonctionnalités, nombre de cartes, 3 tournois à venir ou lien vers l'annuaire, liens catalogue/tournois/boutiques/tutoriel, CTA connexion et inscription, `websiteLd` + `organizationLd`) partagée par `/` et `/en`
- [x] 8.3 `(fr)/page.tsx` : landing sans cookie `cptcg_session`, sinon `Dashboard` derrière un garde `RequireUser` ; retirer `/` de la protection globale d'`AppFrame` ; vérifier avec `curl` sans cookie (landing dans le HTML, pas de « Chargement… ») et avec un cookie de session (tableau de bord protégé, pas de landing) ; déconnexion dans le navigateur : cf. suivi
- [x] 8.4 Rendre `/comment-jouer` public dans `AppFrame`, créer `/en/how-to-play`, brancher `pageMetadata` ; vérifier avec `curl` sans cookie que le texte du tutoriel est dans le HTML

## 9. Vérifications d'ensemble

- [x] 9.1 `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` passent ; aucune donnée de test ne reste en base locale (vérifier l'absence de comptes `@example.com`)
- [x] 9.2 Sur `npm run start` : parcourir chaque page publique FR et EN sans cookie et contrôler titre, description, canonique, hreflang réciproques, `lang` du document, Open Graph et JSON-LD ; contrôler `robots.txt` et que chaque URL du `sitemap.xml` répond 200
- [x] 9.3 Lighthouse SEO ≥ 95 sur `/`, `/cartes`, une fiche de carte, `/tournois/publics` et l'annuaire `/en/shops` (aucune boutique dans la base locale) (mobile)
- [ ] 9.4 Vérifier que `APP_URL` est défini sur le projet Vercel (production) avec le domaine canonique ; après déploiement, valider `robots.txt` et `sitemap.xml` en production et `robots.txt` bloquant en prévisualisation

## Workflow follow-up

- Vérifications manuelles restantes, dans un navigateur ou sur une URL publique (prévisualisation) : bandeau « English version » et sélecteur de langue, parcours connecté « Ajouter à ma collection », déconnexion puis retour sur `/`, Rich Results Test sur une fiche tournoi, boutique et carte, débogueur Open Graph (Facebook / LinkedIn) sur une fiche.
- Soumettre `sitemap.xml` dans Google Search Console et Bing Webmaster Tools, et suivre la couverture d'indexation.
- Archiver le change une fois la revue faite.
