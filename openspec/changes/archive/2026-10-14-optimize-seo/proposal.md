# Proposal

## Why

Le site est quasiment invisible pour les moteurs de recherche. Hors tournois publics, boutiques et pages légales, toutes les pages sont protégées : un robot qui visite `/`, `/cards` ou `/comment-jouer` ne reçoit que « Chargement… » puis l'écran de connexion. Il n'y a ni `sitemap.xml`, ni `robots.txt`, ni `metadataBase` (donc pas d'URL canonique ni d'Open Graph absolu), ni données structurées. La marque est incohérente (« TCG Tracker » dans le pied de page, « Collection Cyberpunk TCG » dans les titres et le manifest), et la langue dépend du `localStorage`, donc une seule version (FR) peut être indexée. Les recherches « carte Cyberpunk TCG <nom> », « tournoi Cyberpunk TCG <ville> » ou « Cyberpunk TCG card list » ne peuvent pas mener au site.

## What Changes

- **Marque unique « TCG Tracker »** : titres (modèle `%s · TCG Tracker`), descriptions, `applicationName`, manifest PWA (nom affiché sur l'écran d'accueil). « Cyberpunk TCG » reste dans les titres comme mot-clé.
- **Page d'accueil publique** : un visiteur sans session voit sur `/` une page de présentation rendue côté serveur (h1, fonctionnalités, liens vers le catalogue, les tournois, les boutiques, le tutoriel, inscription). Un utilisateur connecté garde le tableau de bord actuel.
- **Catalogue public de cartes** : nouvelles pages `/cartes` (liste des 151 cartes de jeu, hors produits scellés, filtrable par couleur et type) et `/cartes/[slug]` (nom, image, coût, puissance, RAM, type, couleur, texte de règles, impressions et extensions, prix indicatif, cartes liées), rendues côté serveur et régénérées périodiquement. Liens « Ajouter à ma collection » vers l'app.
- **Tutoriel public** : `/comment-jouer` devient consultable sans compte.
- **Version anglaise indexable** : préfixe `/en` pour les pages publiques (`/en`, `/en/cards`, `/en/cards/[slug]`, `/en/how-to-play`, `/en/tournaments`, `/en/tournaments/[id]`, `/en/shops`, `/en/shops/[slug]`), `<html lang>` correct, balises `hreflang` réciproques (+ `x-default`) et sélecteur de langue qui renvoie vers l'URL équivalente. Sur ces pages, la langue vient de l'URL et non plus du `localStorage`. **BREAKING (comportement)** : un visiteur ayant choisi l'allemand, l'espagnol ou l'italien voit désormais les pages publiques en français ou en anglais selon l'URL ; un bandeau lui propose la version anglaise.
- **Métadonnées sur toutes les pages** : `metadataBase` depuis `APP_URL`, URL canonique sans paramètres de filtre, Open Graph et Twitter Card, image de partage par défaut générée, image de la carte pour les fiches de carte, image dédiée pour les tournois et boutiques.
- **Exploration** : `robots.txt` (bloque `/api/` sauf les logos de boutique, et `/admin`, déclare le sitemap) et `sitemap.xml` dynamique (pages statiques, cartes, tournois publics à venir, boutiques non refusées, avec `lastModified` et alternatives de langue).
- **Pages non indexables** : `noindex` sur les pages privées ou derrière connexion (`/cards`, `/decks`, `/souhaits`, `/investissement`, `/parametres`, `/tournois` console, `/compte/*`, `/admin/*`), les liens à jeton (`/classeur/*`, `/t/*`, `/tournois/invitation/*`), les tournois annulés et les boutiques refusées, et les pages 404.
- **Données structurées JSON-LD** : `WebSite` et `Organization` sur l'accueil, `BreadcrumbList` sur les pages profondes, `Event` sur les fiches de tournoi public, `Store` sur les fiches de boutique, `ItemList` sur les listes, `CreativeWork` sur les fiches de carte.
- **Sémantique** : un seul `h1` par page publique, textes alternatifs des images de cartes, liens internes entre cartes, tournois et boutiques.

**Hors périmètre** : versions allemande, espagnole et italienne indexables (l'architecture les permettra), traduction des pages légales (restent en français), redirection automatique selon `Accept-Language`, pages par extension ou par produit scellé, blog / actualités, Search Console et soumission manuelle (action d'exploitation, listée dans les tâches comme vérification), optimisation des performances au-delà de ce qu'imposent les nouvelles pages.

## Capabilities

### New Capabilities
- `seo/metadata`: marque, titres, descriptions, URL canonique, Open Graph / Twitter, images de partage, règles d'indexation (`noindex`) par type de page.
- `seo/crawling`: `robots.txt`, `sitemap.xml` et son contenu.
- `seo/structured-data`: données JSON-LD par type de page (site, organisation, fil d'Ariane, événement, boutique, listes, cartes).
- `seo/localization`: URL par langue (FR sans préfixe, EN sous `/en`), `hreflang`, langue du document, sélecteur de langue des pages publiques.
- `catalog/public-cards`: catalogue public de cartes et fiche publique d'une carte.
- `site/landing`: page d'accueil publique pour les visiteurs, accès public au tutoriel.

### Modified Capabilities
_Aucune : les exigences fonctionnelles des tournois publics et des boutiques (`tournaments/public-listing`, `tournaments/discovery`, `shops/profile`) ne changent pas. Leurs pages reçoivent une version anglaise, des métadonnées et des données structurées, couvertes par les nouvelles capacités `seo/*`._

## Impact

- **Routage** (`src/app/`) : les routes actuelles passent dans un groupe `(fr)` avec sa propre mise en page racine (`lang="fr"`) ; nouveau groupe `(en)` sous `/en` (`lang="en"`) ; `global-not-found.tsx` (option `experimental.globalNotFound`). Nouveaux fichiers `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, pages `cartes/` et `en/…`.
- **Composants** : `AppFrame` (accueil, tutoriel et catalogue publics), `LocaleProvider` (langue imposée par l'URL), `Header` / `Footer` (liens localisés, sélecteur de langue), écrans publics (`PublicDirectory`, `PublicTournamentPage`, `ShopDirectory`, `ShopPage`) qui reçoivent des liens localisés ; nouveaux composants de landing, de catalogue et `JsonLd`.
- **Logique** : nouveau module `src/lib/seo/` (URL du site, chemins localisés, fabrique de métadonnées, JSON-LD) ; lecture du catalogue public depuis `src/lib/catalog.ts` ; `src/lib/site.ts` et `manifest.ts` (marque).
- **Configuration** : `APP_URL` doit être défini en production (domaine canonique) ; repli sur `VERCEL_PROJECT_PRODUCTION_URL`.
- **Textes** : nouvelles clés dans `src/lib/i18n/messages.ts` (landing, catalogue, SEO) dans les 5 langues de l'app.
- **Base** : aucun changement de schéma.
- **Dépendances** : aucune (`next/og` est inclus dans Next.js).
