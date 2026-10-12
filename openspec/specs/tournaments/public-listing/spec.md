# tournaments/public-listing Specification

## Purpose
Permettre à un organisateur de rendre son tournoi visible de tous, avec les informations dont un joueur a besoin pour décider de venir (date, lieu, prix, places), et de s'y inscrire sans connaître le code.

## Requirements

### Requirement: Visibilité d'un tournoi
Un tournoi MUST avoir une visibilité `privé` ou `public`. Un tournoi est `privé` à sa création ; seul le comportement actuel (accès par code ou QR) s'applique alors. Seuls les organisateurs MUST pouvoir changer la visibilité, et uniquement tant que le tournoi n'est ni terminé ni annulé.

#### Scenario: Tournoi existant
- **WHEN** un tournoi créé avant cette évolution est consulté
- **THEN** il est privé, n'apparaît dans aucun annuaire et reste accessible par son code

#### Scenario: Co-organisateur publie
- **WHEN** un co-organisateur passe le tournoi en public alors que les informations obligatoires sont remplies
- **THEN** le tournoi devient public

#### Scenario: Tournoi terminé
- **WHEN** un organisateur tente de changer la visibilité d'un tournoi terminé
- **THEN** la demande est refusée (409)

### Requirement: Informations obligatoires pour publier
Un tournoi MUST NOT pouvoir passer en public sans date et heure de début dans le futur et sans lieu résolu (pays, ville et coordonnées). Le refus MUST indiquer les champs manquants.

#### Scenario: Lieu manquant
- **WHEN** un organisateur publie un tournoi qui a une date mais pas de lieu
- **THEN** la publication est refusée et le message cite le lieu comme manquant

#### Scenario: Date passée
- **WHEN** un organisateur publie un tournoi dont la date de début est hier
- **THEN** la publication est refusée

### Requirement: Informations de présentation
Un organisateur MUST pouvoir renseigner, pour tout tournoi, une date et heure de début (avec fuseau horaire du lieu), un lieu, un prix d'entrée (gratuit, ou montant positif et devise), un nombre de places maximum facultatif, une description (2000 caractères maximum) et des lots (500 caractères maximum). Ces champs MUST rester modifiables après publication tant que le tournoi n'est ni terminé ni annulé.

#### Scenario: Tournoi gratuit
- **WHEN** l'organisateur laisse le prix d'entrée vide
- **THEN** le tournoi est affiché comme gratuit

#### Scenario: Description trop longue
- **WHEN** l'organisateur enregistre une description de 2500 caractères
- **THEN** l'enregistrement est refusé avec un message indiquant la limite

### Requirement: Lieu par défaut de la boutique
Quand un tournoi est rattaché à une boutique, son lieu MUST prendre par défaut l'adresse de la boutique ; l'organisateur MUST pouvoir le remplacer par une autre adresse (tournoi hors les murs).

#### Scenario: Tournoi en boutique
- **WHEN** un gérant rattache un nouveau tournoi à sa boutique sans saisir de lieu
- **THEN** le lieu du tournoi est l'adresse de la boutique

### Requirement: Rattachement à une boutique
Un tournoi MUST pouvoir être rattaché à au plus une boutique, et seulement par un organisateur du tournoi qui gère cette boutique. Le rattachement MUST pouvoir être retiré par un organisateur du tournoi ou par le gérant de la boutique.

#### Scenario: Boutique d'un autre
- **WHEN** un utilisateur tente de rattacher son tournoi à une boutique qu'il ne gère pas
- **THEN** la demande est refusée (403)

### Requirement: Fiche publique d'un tournoi public
Un tournoi public MUST avoir une fiche consultable sans compte, présentant nom, date, lieu (adresse et carte), prix, lots, description, format, Bo1/Bo3, organisateur ou boutique (avec badge si vérifiée), nombre d'inscrits, places restantes et statut. La fiche MUST NOT afficher le code du tournoi ni les joueurs en attente d'approbation. Un tournoi privé MUST répondre « introuvable » sur cette fiche.

#### Scenario: Visiteur anonyme
- **WHEN** un visiteur non connecté ouvre la fiche d'un tournoi public
- **THEN** il voit les informations du tournoi mais pas son code

#### Scenario: Tournoi redevenu privé
- **WHEN** un visiteur ouvre la fiche d'un tournoi repassé en privé
- **THEN** la fiche répond « tournoi introuvable » (404)

### Requirement: Résultats d'un tournoi public terminé
La fiche d'un tournoi public terminé MUST afficher le champion et le classement final (pseudos, points, bilan) ; elle MUST rester consultable après la fin du tournoi.

#### Scenario: Consultation après le tournoi
- **WHEN** un joueur ouvre la fiche d'un tournoi public terminé la veille
- **THEN** il voit le champion et le classement final

### Requirement: Inscription sans code
Depuis la fiche d'un tournoi public, une personne MUST pouvoir s'inscrire sans code, avec son compte ou en invité, selon exactement les mêmes règles que l'inscription par code (ouverture, pseudo unique, approbation, retard, capacité). Après inscription elle MUST arriver sur sa vue joueur. Cette inscription MUST être limitée en débit par IP.

#### Scenario: Inscription en un clic
- **WHEN** un utilisateur connecté clique « S'inscrire » sur la fiche d'un tournoi public ouvert
- **THEN** il est inscrit avec son nom affiché comme pseudo et redirigé vers sa vue joueur

#### Scenario: Inscriptions fermées
- **WHEN** une personne tente de s'inscrire depuis la fiche alors que le TO a fermé les inscriptions
- **THEN** l'inscription est refusée avec le même message que par code

### Requirement: Export calendrier
La fiche d'un tournoi public MUST proposer un fichier calendrier (iCalendar) contenant le nom, la date de début, une fin estimée d'après le nombre de rondes et leur durée, le lieu et le lien vers la fiche.

#### Scenario: Ajout à l'agenda
- **WHEN** un joueur télécharge le fichier calendrier d'un tournoi à 14 h avec 3 rondes de 50 minutes
- **THEN** le fichier contient un événement commençant à 14 h, au lieu du tournoi, avec le lien vers la fiche

### Requirement: Retour en privé
Un organisateur MUST pouvoir repasser un tournoi public en privé ; les joueurs déjà inscrits MUST le rester, et le tournoi MUST disparaître immédiatement de l'annuaire et de la page boutique.

#### Scenario: Dépublication
- **WHEN** un TO repasse en privé un tournoi qui a 12 inscrits
- **THEN** les 12 joueurs restent inscrits et le tournoi n'apparaît plus dans l'annuaire
