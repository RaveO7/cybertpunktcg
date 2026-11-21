# site/first-load Specification

## Purpose
Limiter ce que le navigateur télécharge et exécute avant le premier affichage d'une page, et lancer au plus tôt les données dont les pages privées ont besoin pour s'afficher.

## Requirements

### Requirement: Fenêtres et panneaux chargés à l'ouverture
Le code d'une fenêtre ou d'un panneau qui ne s'affiche qu'après une action de l'utilisateur SHALL NOT faire partie du JS chargé au premier affichage de la page. Il MUST être chargé à la première ouverture, avec un état de chargement visible si le code n'est pas encore là.

#### Scenario: Collection ouverte sans fenêtre
- **WHEN** un compte connecté ouvre la collection sans carte sélectionnée dans l'URL
- **THEN** le JS de la fiche de carte en fenêtre, de l'ajout rapide et de la liste de souhaits n'est pas téléchargé

#### Scenario: Première ouverture d'une carte
- **WHEN** l'utilisateur ouvre une carte de la collection pour la première fois
- **THEN** la fenêtre s'affiche avec la carte, après un état de chargement si son code n'était pas encore arrivé

#### Scenario: Lien direct vers une carte ouverte
- **WHEN** la collection est ouverte avec une carte sélectionnée dans l'URL
- **THEN** la fenêtre de cette carte s'affiche comme aujourd'hui

### Requirement: Requêtes de démarrage sans session mémorisée
Sur une page privée, quand le navigateur a une session, collection et catalogue SHALL partir dès le `<head>`, avant le JS, même sans session mémorisée sur l'appareil. Un cookie lisible et sans secret MUST signaler la présence de la session ; il MUST NOT donner aucun accès.

#### Scenario: Session présente sans session mémorisée
- **WHEN** un compte connecté ouvre la collection sur un navigateur sans session mémorisée, par exemple après effacement du stockage local
- **THEN** les requêtes de la collection et du catalogue partent depuis le `<head>`, avant l'hydratation

#### Scenario: Déconnexion
- **WHEN** le cookie de session est absent ou a été supprimé
- **THEN** le cookie indicateur est supprimé et aucune requête de démarrage n'est lancée sans session mémorisée

#### Scenario: Cookie indicateur sans session valide
- **WHEN** le cookie indicateur est présent mais que la session est refusée par le serveur
- **THEN** l'écran de connexion s'affiche, comme pour une session expirée
