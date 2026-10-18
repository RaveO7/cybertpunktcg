# Spec Delta

## Purpose

Permettre à un utilisateur déjà connecté de retrouver immédiatement son espace à chaque ouverture du site ou de l'application installée, sans repasser par un écran de connexion, tout en gardant le serveur seul juge de la validité de la session.

## ADDED Requirements

### Requirement: Reprise immédiate de la session mémorisée
Quand l'appareil a mémorisé une session ouverte, l'application MUST afficher dès son premier rendu côté client l'en-tête avec la navigation du compte et le cadre de la page demandée, sans attendre de réponse du serveur. La session MUST quand même être vérifiée en arrière-plan à chaque démarrage.

#### Scenario: Ouverture de l'application installée
- **WHEN** un utilisateur connecté ouvre l'application installée sur l'accueil
- **THEN** l'en-tête avec la navigation et le cadre du tableau de bord s'affichent sans attendre la réponse du serveur, et l'écran de connexion n'apparaît à aucun moment

#### Scenario: Page réservée aux comptes ouverte directement
- **WHEN** un utilisateur connecté ouvre directement `/decks` dans un nouvel onglet
- **THEN** la navigation et l'écran des decks s'affichent sans écran de connexion intermédiaire

### Requirement: Affichage indépendant du chargement des données
La navigation et l'accès aux pages réservées aux comptes MUST dépendre uniquement de la session, pas du chargement du catalogue ni de la collection. Tant que ses données ne sont pas chargées, un écran MUST afficher son propre état de chargement à l'intérieur du cadre.

#### Scenario: Catalogue lent
- **WHEN** la session est connue mais que le catalogue met plusieurs secondes à arriver
- **THEN** la navigation est utilisable et le tableau de bord affiche son état de chargement, pas l'écran de connexion

### Requirement: Écran de connexion réservé aux sessions refusées
L'écran de connexion MUST s'afficher sur une page réservée aux comptes seulement si aucune session n'est mémorisée sur l'appareil et que le serveur n'en reconnaît aucune, ou si le serveur a refusé la session. Une erreur réseau ou une réponse lente MUST NOT faire apparaître l'écran de connexion à un utilisateur dont la session est mémorisée.

#### Scenario: Réseau indisponible au démarrage
- **WHEN** un utilisateur avec une session mémorisée ouvre l'application et que la vérification de session échoue pour une raison réseau
- **THEN** il reste dans son espace (avec les données en cache s'il y en a, ou un message d'erreur de chargement) et ne voit pas l'écran de connexion

#### Scenario: Première visite sans session
- **WHEN** un visiteur sans session mémorisée ni cookie ouvre `/decks`
- **THEN** il voit l'écran de connexion une fois la vérification terminée

### Requirement: Session refusée par le serveur
Quand le serveur répond que la session n'est pas valide (expirée, révoquée ou compte supprimé), au démarrage ou pendant l'utilisation, l'application MUST effacer la session mémorisée sur l'appareil, vider les données du compte affichées et afficher l'écran de connexion.

#### Scenario: Session révoquée depuis un autre appareil
- **WHEN** l'application démarre avec une session mémorisée mais que le serveur répond 401 à la vérification
- **THEN** l'écran de connexion remplace le cadre du compte et une ouverture suivante ne reprend plus cette session

### Requirement: Session mémorisée limitée à l'affichage
La session mémorisée sur l'appareil MUST contenir seulement des informations d'affichage du compte (identifiant, nom affiché, e-mail) et MUST NOT servir de preuve d'authentification : chaque donnée du compte MUST toujours être servie par le serveur au vu du cookie de session. La déconnexion MUST effacer la session mémorisée.

#### Scenario: Déconnexion
- **WHEN** l'utilisateur se déconnecte puis rouvre l'application
- **THEN** aucune navigation de compte n'est affichée avant la vérification, et une page réservée aux comptes montre l'écran de connexion

#### Scenario: Valeur mémorisée falsifiée
- **WHEN** la session mémorisée est modifiée à la main sans cookie de session valide
- **THEN** le serveur refuse les requêtes du compte, et l'application efface la valeur et affiche l'écran de connexion
