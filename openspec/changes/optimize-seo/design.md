# Design

## Context

Voir `proposal.md` (Why) pour la motivation. État actuel qui contraint l'approche :

- **Une seule mise en page racine** (`src/app/layout.tsx`) avec `<html lang="fr">` en dur, les polices, le script de thème et les fournisseurs (`LocaleProvider`, `PreferencesProvider`, `CollectionProvider`, …) autour d'`AppFrame`.
- **`AppFrame`** (client) protège toutes les routes sauf une liste blanche par préfixe (`/classeur/`, `/t/`, `/tournois/publics`, `/boutiques`, pages légales) : sans session vérifiée il affiche « Chargement… » puis `AuthScreen` à la place de la page. C'est ce que voient les robots sur `/`, `/cards`, `/comment-jouer`.
- **Langue** : `LocaleProvider` lit `localStorage` (`cptcg-locale`, 5 langues) via `useSyncExternalStore` ; le rendu serveur est toujours en `fr`. Aucune langue dans l'URL.
- **Catalogue** : `loadCatalogCached()` (`unstable_cache`, tag `catalog`, revalidation 1 h, invalidé par `revalidateTag` après l'import des prix) renvoie cartes, impressions, extensions et prix. 173 cartes, 750 impressions (576 EN, 174 FR), produits scellés rangés dans des extensions `sealed-*` (`isSealedSetCode`). `Card.slug` est unique et stable.
- **Pages publiques existantes** : `/tournois/publics`, `/tournois/publics/[id]`, `/boutiques`, `/boutiques/[slug]` sont rendues côté serveur puis hydratées ; elles ont déjà un `generateMetadata` minimal (titre + description).
- **URL du site** : `APP_URL` existe déjà (`src/lib/app-url.ts`) mais seulement par requête ; pas de `metadataBase`.
- **Session** : cookie `cptcg_session` (`SESSION_COOKIE`, `src/lib/auth.ts`).
- Next.js 16.3 : `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` (`next/og`), plusieurs mises en page racines par groupes de routes, `global-not-found.tsx` derrière `experimental.globalNotFound`.

## Goals / Non-Goals

**Goals:**
- Tout le contenu public indexable présent dans le HTML du premier rendu serveur.
- Une seule source de vérité pour la correspondance des routes FR ↔ EN, utilisée par les métadonnées, le sitemap, les liens et le sélecteur de langue.
- Les fiches de carte servies en statique régénéré (pas de requête base à chaque visite).
- Aucun changement visible pour l'utilisateur connecté dans l'application (hors nom de marque).

**Non-Goals:**
- Préfixe de langue pour les pages de l'application connectée (elles sont `noindex`).
- Rendu serveur des écrans connectés (`Dashboard`, `CardsExplorer`, …).
- Refonte visuelle : la landing et le catalogue réutilisent les composants et jetons de style existants.

## Decisions

### 1. Deux mises en page racines par groupes de routes
Toutes les routes actuelles (sauf `api/` et les fichiers de métadonnées racine) passent dans `src/app/(fr)/` dont `layout.tsx` rend `<html lang="fr">`. Les pages anglaises vivent dans `src/app/(en)/en/…` avec `src/app/(en)/layout.tsx` qui rend `<html lang="en">`. Le contenu commun (polices, script de thème, fournisseurs, `AppFrame`, analytics) est extrait dans un composant serveur partagé `SiteShell({ lang, children })`. Une page 404 globale (`global-not-found.tsx`, `experimental.globalNotFound: true`) remplace le `not-found.tsx` racine pour les URL sans route ; chaque groupe garde son `not-found.tsx` (et `error.tsx`), réexportés depuis `src/components/site/`. Le `loading.tsx` racine est supprimé : il enveloppait toutes les pages dans un `Suspense`, si bien que la réponse partait avant `notFound()` et qu'une fiche inexistante répondait 200 (avec `noindex`) au lieu de 404. L'icône Apple passe dans `public/icons/` et est déclarée dans les métadonnées (un fichier `apple-icon.png` à la racine de `app/` n'est rattaché à aucune mise en page).

*Alternatives* : lire la langue dans `headers()` depuis un `proxy.ts` (rend toutes les pages dynamiques et casse la régénération statique des fiches) ; segment dynamique `[lang]` au sommet (imposerait `/fr/…` et casserait toutes les URL existantes et les liens partagés) ; corriger `lang` côté client seulement (le HTML servi aux robots resterait faux). Coût accepté : passer d'une langue à l'autre recharge la page complète.

### 2. Table de routes localisées dans `src/lib/seo/routes.ts`
Un tableau déclaratif `{ key, fr: "/cartes/[slug]", en: "/en/cards/[slug]" }` pour les 8 pages publiques bilingues, plus les pages FR seules (légales). Fonctions pures : `localizedPath(key, locale, params, search?)`, `routeOfPath(pathname)` → `{ key, locale, params } | null`, `alternatePath(pathname, search, targetLocale)`, `languageAlternates(key, params)` (pour `metadata.alternates.languages` et le sitemap, `x-default` = FR). Testées unitairement. Ajouter DE/ES/IT plus tard = ajouter une colonne.

### 3. Langue imposée par le chemin dans `LocaleProvider`
`LocaleProvider` appelle `usePathname()` et `routeOfPath()` : si le chemin est une page publique localisée, la langue est celle de la route (identique au serveur et au client, pas d'écart d'hydratation) ; sinon, comportement actuel (`localStorage`). `setLocale` sur une page localisée enregistre la préférence puis navigue vers `alternatePath(...)`. `Header`, `Footer` et les pages publiques obtiennent la langue par `useI18n()` comme aujourd'hui, et un hook `useLocalizedHref()` pour leurs liens.

*Alternative* : un fournisseur imbriqué dans chaque page publique (ne couvrirait pas `Header`/`Footer`, rendus par `AppFrame` au-dessus de la page).

### 4. Pages bilingues = fichiers de route minces + modules partagés
Chaque paire de routes appelle le même module dans `src/components/public-site/` (ou `src/lib/seo/pages/`) avec la langue en argument : `cardPage(locale, params)`, `cardPageMetadata(locale, params)`, etc. Les routes existantes `/tournois/publics/*` et `/boutiques/*` sont refactorées de la même façon pour servir `/en/tournaments/*` et `/en/shops/*`. Les liens internes de `PublicDirectory`, `PublicTournamentPage`, `ShopDirectory`, `ShopPage` passent par `useLocalizedHref()`.

### 5. Accueil : choix serveur par présence du cookie de session
`(fr)/page.tsx` lit `cookies()` : sans `cptcg_session`, il rend la landing (composant serveur, contenu dans le HTML) ; avec, il rend le `Dashboard` derrière un garde client (`RequireUser`) qui reproduit la protection actuelle (cookie expiré → `AuthScreen`). `/` sort donc de la protection globale d'`AppFrame`. `/en` rend toujours la landing (avec lien « Ouvrir l'application » si connecté). La page `/` devient dynamique, ce qui est déjà le cas en pratique.

*Alternative* : landing pour tous et tableau de bord sur `/tableau-de-bord` (casse l'habitude et l'icône PWA `start_url: "/"`).

### 6. Connexion depuis les pages publiques : route `/connexion`
Nouvelle route `noindex` qui rend `AuthScreen` (mode connexion ou inscription par `?mode=`) et, une fois l'utilisateur connecté, redirige vers `next` (chemin relatif validé par `safeNextPath`, défaut `/`). La landing, le catalogue et les fiches y renvoient. Les erreurs OAuth, qui revenaient sur `/?authError=`, reviennent sur `/connexion` (sur `/`, un visiteur voit désormais la landing). Le bouton « Ajouter à ma collection » réutilise le paramètre existant `?printing=<id>` de l'explorateur (impression affichée sur la fiche) : aucun nouveau paramètre.

### 7. Catalogue public en composants serveur, statique régénéré
`/cartes` et `/cartes/[slug]` (et `/en/cards/*`) sont des composants serveur sans JavaScript client obligatoire, alimentés par `loadCatalogCached()` (aucune nouvelle requête). Fiches : `generateStaticParams` (toutes les cartes actives hors scellés), `dynamicParams = true`, `revalidate = 3600`. Le tag `catalog` déjà invalidé après l'import des prix rafraîchit aussi ces pages. Filtres couleur/type en liens `?color=&type=` lus via `searchParams` sur `/cartes` (page dynamique mise en cache CDN, canonique sans paramètres). Images : miniatures existantes (`thumbnailPath`) avec `width`/`height`, `alt` = nom de la carte, `loading="lazy"` sauf les premières. Contenu FR : impression `language = "fr"` si elle existe (`localizedName`, `printedRulesText`, image), sinon EN.

### 8. Métadonnées centralisées
`src/lib/seo/site.ts` : `siteUrl()` = `APP_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` → `http://localhost:3000` ; `isProductionDeployment()` = `VERCEL_ENV === "production"` (ou absence de `VERCEL_ENV` avec `APP_URL` défini). `SITE.name` devient « TCG Tracker ». `src/lib/seo/metadata.ts` : `pageMetadata({ locale, key, params, title, description, image?, noindex? })` qui remplit `title`, `description` (tronquée à 160 sur une limite de mot), `alternates.canonical` et `alternates.languages`, `openGraph` (`siteName`, `locale` `fr_FR`/`en_US`, `type`, `images`) et `twitter`. Chaque mise en page racine pose `metadataBase: new URL(siteUrl())` et `title.template: "%s · TCG Tracker"`. `privateMetadata` = `{ robots: { index: false, follow: false } }`, exporté par chaque page privée ou à jeton.

### 9. Images de partage générées
Routes `next/og` (1200×630) : `/og/[locale]` (par défaut), `/og/tournament/[id]/[locale]`, `/og/shop/[slug]/[locale]`, référencées explicitement par `pageMetadata` plutôt que par des fichiers `opengraph-image.tsx` (leur héritage entre segments quand une page définit son propre `openGraph` est ambigu, et ils seraient dupliqués dans les deux groupes). Mise en cache CDN une heure. Police par défaut de `next/og`. Les fiches de carte déclarent directement l'image de la carte. Le logo de boutique (WebP en base) est converti en PNG par `sharp`, format accepté par le moteur de rendu. `robots.txt` autorise `/api/shops/*/logo` pour que le logo des données structurées reste lisible.

### 10. Exploration
`src/app/robots.ts` : production → `allow: "/"`, `disallow: ["/api/", "/admin"]`, `sitemap` absolu ; ailleurs → `disallow: "/"`. `src/app/sitemap.ts` (revalidation 3600) construit les entrées à partir de la table de routes : pages statiques, cartes (`Card.updatedAt` ou date la plus récente de ses impressions/prix), boutiques `status ≠ rejected` (`updatedAt`), tournois `visibility = public`, non annulés, `startsAt` futur ou < 180 jours (`updatedAt`). Chaque entrée bilingue porte `alternates.languages`. Moins de 50 000 URL : un seul fichier.

### 11. JSON-LD
Composant serveur `JsonLd({ data })` qui sérialise avec `JSON.stringify(data).replace(/</g, "\\u003c")` (recommandation Next.js) dans `<script type="application/ld+json">`. Constructeurs purs et testés dans `src/lib/seo/structured-data.ts` : `websiteLd`, `organizationLd`, `breadcrumbLd`, `eventLd` (statut `EventScheduled`/`EventCancelled`, `eventAttendanceMode` présentiel, `offers.availability` `InStock`/`SoldOut`, prix `0` si gratuit), `storeLd` (horaires → `openingHoursSpecification`, propriétés vides omises), `itemListLd`, `cardLd` (`CreativeWork`, `isPartOf` = jeu Cyberpunk TCG). Les fils d'Ariane visibles utilisent les mêmes données que `breadcrumbLd`.

### 12. Pages exclues et contenus retirés
`privateMetadata` sur : `cards`, `decks`, `souhaits`, `investissement`, `parametres`, `tournois` (console), `tournois/[id]`, `tournois/invitation/[token]`, `t/[code]`, `t/claim/[token]`, `classeur/[token]` (+ `cartes`), `compte/*`, `admin/*`, `connexion`. `/cards` affiche en plus un lien vers `/cartes` pour les visiteurs. Tournoi public annulé : `generateMetadata` ajoute `noindex`. 404 : Next.js ajoute déjà `noindex` aux réponses `notFound()` ; vérifié par un test.

### 12 bis. Titres et textes
Les titres sont limités à 70 caractères : le suffixe « · TCG Tracker » n'est ajouté que s'il tient, sinon le titre est coupé sur une limite de mot (`fitTitle`). Les textes des pages publiques rendues côté serveur (FR et EN uniquement) vivent dans `src/lib/seo/copy.ts` ; seuls les libellés partagés avec l'application (navigation visiteur, lien catalogue de l'écran de connexion) vont dans `messages.ts` (5 langues). Les horaires de boutique étant saisis en texte libre, `storeLd` ne publie que les plages reconnues (« Mar–Sam 10h–19h », « Tue-Sat 10am-7pm ») ; le reste est omis.

### 13. Suggestion de version anglaise
Composant client sur les pages publiques FR : s'affiche si la préférence enregistrée ou `navigator.language` n'est pas `fr` et si `localStorage` ne contient pas la clé de refus ; lien vers `alternatePath(..., "en")`. Rendu uniquement après montage (aucune différence dans le HTML servi aux robots).

## Risks / Trade-offs

- [Déplacement de toutes les routes dans `(fr)/` : gros diff, risque de casser des imports relatifs ou des tests qui pointent vers `src/app/...`] → déplacement mécanique en un commit isolé (`git mv`), alias `@/` déjà utilisés partout, `npm run typecheck`, `npm run build` et la suite de tests avant de continuer.
- [`global-not-found` est expérimental dans Next 16] → page minimale autonome (polices et styles importés, thème sombre) ; en cas de problème, repli possible sur un `not-found.tsx` par groupe et un `[...rest]` attrape-tout dans `(fr)`.
- [Changement de langue entre `/` et `/en` = rechargement complet (deux racines)] → acceptable : action rare, l'état durable est en base ou `localStorage`.
- [Utilisateurs DE/ES/IT voient les pages publiques en FR ou EN] → bandeau de suggestion EN ; l'application connectée garde leur langue ; la table de routes permet d'ajouter ces langues plus tard.
- [Lecture de `cookies()` sur `/` : pas de cache statique de l'accueil] → la landing ne fait que des lectures en cache (`loadCatalogCached`, tournois à venir limités à 3).
- [Cookie présent mais session expirée] → `RequireUser` affiche `AuthScreen` comme aujourd'hui ; à la déconnexion le cookie est supprimé et `/` redevient la landing.
- [`APP_URL` absent en production → URL canoniques sur `*.vercel.app`] → repli sur `VERCEL_PROJECT_PRODUCTION_URL` (domaine de production principal) et tâche de vérification de la variable sur Vercel.
- [Changement du nom PWA : les icônes installées gardent l'ancien nom jusqu'à mise à jour du manifest par le navigateur] → incrémenter `?v=` n'est pas nécessaire pour le nom ; accepté.
- [Contenu dupliqué FR/EN pour les cartes sans impression française (texte anglais sur les deux URL)] → `hreflang` réciproque et interface traduite ; risque faible.

## Migration Plan

1. Commit isolé : déplacement des routes dans `(fr)/` + `SiteShell` + `(en)/layout.tsx` vide + `global-not-found`, sans changement de comportement ; build et tests verts.
2. Fondations SEO (`src/lib/seo/*`, marque, `metadataBase`, `robots`, `sitemap`, `noindex`), puis pages publiques nouvelles et versions anglaises.
3. Déploiement en prévisualisation : vérifier `robots.txt` (tout bloqué), puis en production : `robots.txt`, `sitemap.xml`, rendu sans JavaScript, Rich Results Test sur une fiche tournoi, boutique et carte.
4. Retour arrière : revert du merge ; aucun changement de schéma ni de données.
