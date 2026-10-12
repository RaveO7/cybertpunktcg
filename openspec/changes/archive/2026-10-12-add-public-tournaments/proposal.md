# Proposal

## Why

Aujourd'hui un tournoi n'est trouvable que si l'on connaît son code : un joueur ne peut pas découvrir les tournois organisés près de chez lui, et une boutique ne peut pas utiliser l'app pour faire venir de nouveaux joueurs. Un annuaire public de tournois, filtrable par lieu et par date, avec des pages boutique, donne aux joueurs une raison de revenir dans l'app et aux boutiques une vitrine gratuite (publicité indirecte).

## What Changes

- **Tournoi public** : un organisateur (particulier ou boutique) choisit la visibilité `privé` (comportement actuel, accès par code) ou `public`. Un tournoi public porte des informations de présentation : date et heure de début, lieu (adresse géocodée), prix d'entrée (gratuit ou montant + devise), nombre de places maximum, description, lots. Il est rattachable à une boutique dont l'organisateur gère le profil.
- **Fiche publique** d'un tournoi public : informations, organisateur / boutique, nombre d'inscrits, places restantes, résultats une fois terminé, export calendrier (`.ics`), inscription en un clic **sans code** (compte ou invité, mêmes règles que l'inscription par code).
- **Places et liste d'attente** : quand le tournoi est complet, les nouveaux inscrits passent en liste d'attente ; un désistement avant le début promeut automatiquement le premier en attente. Le TO peut toujours dépasser la limite manuellement.
- **Annuaire `/tournois/publics`** : liste et carte des tournois publics à venir, filtres pays, région, ville, rayon en km autour d'un point (géolocalisation du navigateur ou ville saisie), période, format (boutique / compétitif), Bo1 / Bo3, gratuit / payant, places restantes, boutique. Tri par date ou par distance. Les tournois des boutiques vérifiées sont mis en avant.
- **Profil boutique** : un utilisateur crée un profil boutique (nom, logo, description, adresse géocodée, site web, réseaux sociaux, horaires). Page publique `/boutiques/[slug]` avec les prochains tournois et les derniers résultats. Annuaire des boutiques sur la même carte.
- **Vérification des boutiques** : une boutique nouvellement créée est `en attente` ; un **administrateur** la valide (badge « Boutique vérifiée ») ou la refuse avec un motif. Une boutique non vérifiée peut publier des tournois publics, mais sans badge ni mise en avant. Nouveau rôle global `admin` et page d'administration minimale.
- **Géocodage** : saisie d'adresse avec suggestions (France) ou résolution à l'enregistrement (autres pays), stockage pays / région / ville / code postal / latitude / longitude.
- Textes dans les 5 langues de l'app (FR, EN, DE, ES, IT), lien « Tournois publics » dans la navigation.

**Hors périmètre** (changes ultérieurs) : abonnement à une boutique ou à une zone avec notifications, tournois récurrents, classements locaux / saisonniers, statistiques boutique, widget intégrable, image de partage OpenGraph, paiement en ligne, signalement et modération des tournois.

## Capabilities

### New Capabilities
- `tournaments/public-listing`: visibilité d'un tournoi, informations publiques (date, lieu, prix, places, description, lots, boutique), fiche publique, inscription sans code, export calendrier, retour en privé.
- `tournaments/capacity`: nombre de places, liste d'attente, promotion automatique, dépassement par le TO.
- `tournaments/discovery`: annuaire public des tournois, filtres (lieu, rayon, période, format, prix, places, boutique), tri, vue carte, mise en avant des boutiques vérifiées.
- `shops/profile`: création et édition d'un profil boutique, page publique, rattachement des tournois à une boutique, suppression.
- `shops/verification`: rôle administrateur, demande de vérification, validation / refus / retrait, badge.
- `locations/geocoding`: recherche et résolution d'adresse, normalisation du lieu (pays, région, ville, coordonnées), recherche « autour de moi ».

### Modified Capabilities
_Aucune : `openspec/specs/` est encore vide. Les specs de `add-tournament-management` (inscription, cycle de vie) ne sont pas encore archivées ; ce change les complète par de nouvelles capacités sans en modifier les exigences. Il est conseillé d'archiver `add-tournament-management` avant d'archiver celui-ci._

## Impact

- **Base** (`prisma/schema.prisma`) : nouveaux champs sur `Tournament` (visibilité, date, lieu, prix, places, description, lots, `shopId`), nouveau statut joueur `waitlist`, nouveau modèle `Shop` (profil + statut de vérification), champ `role` sur `User`. Le tournoi garde son absence de cascade depuis `User` ; supprimer une boutique détache ses tournois sans les supprimer.
- **API** : routes `src/app/api/tournaments/public/…` (annuaire, fiche, inscription sans code, `.ics`), `src/app/api/shops/…`, `src/app/api/admin/shops/…`, `src/app/api/geocode/…` ; schémas zod dans `src/lib/api-schemas.ts` ; limitation de débit sur le géocodage et l'inscription publique.
- **Logique** : `src/lib/tournament/` (inscription avec capacité / liste d'attente, vue publique), nouveaux modules `src/lib/shops/` et `src/lib/geo/` (géocodage, distance).
- **UI** : pages `/tournois/publics`, `/tournois/publics/[id]`, `/boutiques`, `/boutiques/[slug]`, `/compte/boutique`, `/admin/boutiques` ; nouvel encadré « Publication » dans les réglages du tournoi ; textes dans `src/lib/i18n/messages.ts`.
- **Services externes** : Géoplateforme IGN (ex-API Adresse, France) et Nominatim OpenStreetMap (reste du monde) pour le géocodage, tuiles OpenStreetMap pour la carte. Aucune clé d'API.
- **Dépendances** : une bibliothèque de carte légère (Leaflet) ; `sharp` passe en dépendance d'exécution pour redimensionner les logos.
