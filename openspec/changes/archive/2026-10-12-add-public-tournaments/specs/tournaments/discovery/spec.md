## Purpose

Aider un joueur à trouver les tournois publics qui l'intéressent, près de chez lui et aux dates qui lui conviennent, sous forme de liste ou de carte.

## ADDED Requirements

### Requirement: Annuaire des tournois publics
Une page publique, consultable sans compte, MUST lister les tournois publics à venir ou en cours, c'est-à-dire non terminés, non annulés et dont la date de début date de moins de 12 heures. Les tournois privés MUST NOT y apparaître. Chaque entrée MUST montrer nom, date, ville, distance (si un point de recherche est connu), prix, places restantes, format et boutique.

#### Scenario: Tournoi privé
- **WHEN** un visiteur consulte l'annuaire
- **THEN** aucun tournoi privé n'y figure

#### Scenario: Tournoi passé
- **WHEN** un tournoi public a commencé il y a 14 heures et n'a pas été clôturé
- **THEN** il n'apparaît plus dans l'annuaire

### Requirement: Filtres de lieu
L'annuaire MUST permettre de filtrer par pays, puis par région et par ville parmi celles qui ont des tournois publics à venir. Chaque liste de choix MUST être limitée au niveau supérieur choisi.

#### Scenario: Filtre par ville
- **WHEN** un joueur choisit France puis Lyon
- **THEN** seuls les tournois dont le lieu est à Lyon sont listés

#### Scenario: Choix de région limités
- **WHEN** un joueur choisit Belgique
- **THEN** la liste des régions ne propose que des régions belges ayant des tournois

### Requirement: Recherche par rayon
L'annuaire MUST permettre de chercher autour d'un point, donné par la géolocalisation du navigateur (avec l'accord de l'utilisateur) ou par une ville saisie, dans un rayon de 5, 10, 25, 50, 100 ou 200 km. La distance MUST être calculée à vol d'oiseau. La position de l'utilisateur MUST NOT être enregistrée côté serveur.

#### Scenario: Autour de moi
- **WHEN** un joueur autorise la géolocalisation et choisit 25 km
- **THEN** seuls les tournois situés à 25 km ou moins sont listés, avec leur distance

#### Scenario: Géolocalisation refusée
- **WHEN** le navigateur refuse la géolocalisation
- **THEN** l'annuaire propose de saisir une ville et reste utilisable

### Requirement: Autres filtres
L'annuaire MUST permettre de filtrer par période (aujourd'hui, ce week-end, 7 jours, 30 jours, dates libres), format (boutique / compétitif), type de match (Bo1 / Bo3), prix (gratuit / payant), places restantes uniquement, inscriptions ouvertes uniquement, et boutique. Les filtres MUST se combiner et MUST être reflétés dans l'URL pour pouvoir être partagés.

#### Scenario: Filtres combinés
- **WHEN** un joueur filtre « ce week-end », « gratuit » et « Bo3 »
- **THEN** seuls les tournois remplissant les trois conditions sont listés

#### Scenario: Lien partagé
- **WHEN** un joueur ouvre un lien d'annuaire contenant des filtres
- **THEN** l'annuaire s'affiche avec ces filtres appliqués

### Requirement: Tri et mise en avant
L'annuaire MUST être trié par date de début croissante, ou par distance croissante quand un point de recherche est connu et que l'utilisateur le choisit. À critère égal, un tournoi de boutique vérifiée MUST passer avant les autres, et MUST porter le badge de vérification.

#### Scenario: Même heure
- **WHEN** deux tournois commencent à la même heure, dont un dans une boutique vérifiée
- **THEN** celui de la boutique vérifiée est listé en premier, avec son badge

### Requirement: Vue carte
L'annuaire MUST proposer une vue carte affichant les tournois filtrés à leur emplacement, regroupés par lieu quand plusieurs tournois partagent la même adresse ; un clic MUST ouvrir un résumé avec un lien vers la fiche. La carte MUST mentionner la source des données cartographiques.

#### Scenario: Plusieurs tournois dans la même boutique
- **WHEN** une boutique publie 3 tournois à venir
- **THEN** la carte montre un seul repère à son adresse, qui liste les 3 tournois

### Requirement: Pagination et performance
L'annuaire MUST renvoyer au plus 50 tournois par page avec un accès aux pages suivantes, et la vue carte au plus 500 repères pour la zone affichée.

#### Scenario: Beaucoup de résultats
- **WHEN** 120 tournois correspondent aux filtres
- **THEN** la liste en montre 50 et propose la page suivante

### Requirement: Accès depuis la navigation
La page « Tournois » MUST proposer un accès à l'annuaire public, y compris pour un visiteur non connecté.

#### Scenario: Visiteur non connecté
- **WHEN** un visiteur non connecté ouvre l'app
- **THEN** il peut atteindre l'annuaire des tournois publics sans créer de compte
