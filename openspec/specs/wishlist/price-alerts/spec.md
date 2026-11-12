# wishlist/price-alerts Specification

## Purpose
TBD - created by archiving change improve-site-and-app. Update Purpose after archive.

## Requirements

### Requirement: Déclenchement d'une alerte de prix
Après chaque import des prix, une alerte MUST se déclencher pour chaque tirage de la liste de souhaits dont le prix tendance Cardmarket passe au niveau du prix cible ou en dessous, alors qu'aucune alerte n'était en cours. Une alerte en cours MUST suivre le prix sans se redéclencher. Une alerte MUST s'effacer quand le prix repasse au-dessus de la cible, et une baisse suivante MUST déclencher une nouvelle alerte.

#### Scenario: Prix sous la cible
- **WHEN** un tirage a une cible de 5 € et que l'import fixe son prix tendance à 4,80 €
- **THEN** une alerte non vue est créée au prix de 4,80 €

#### Scenario: Pas de répétition
- **WHEN** le prix reste sous la cible lors de l'import suivant
- **THEN** aucune nouvelle alerte n'est déclenchée

### Requirement: Alertes dans l'application
L'application MUST signaler le nombre d'alertes non vues et les mettre en évidence dans la liste de souhaits. Ouvrir la liste de souhaits MUST les marquer comme vues.

#### Scenario: Alerte vue
- **WHEN** l'utilisateur ouvre la liste de souhaits avec 2 alertes non vues
- **THEN** les 2 alertes sont mises en évidence, puis comptées comme vues

### Requirement: Activation des notifications
L'utilisateur MUST pouvoir activer et désactiver les notifications d'alerte de prix sur chacun de ses appareils, depuis les réglages. La liste de souhaits MUST le lui proposer quand il définit son premier prix cible. L'activation MUST demander l'autorisation du navigateur et n'être enregistrée que si elle est accordée. Quand le navigateur ne gère pas les notifications push, ou que l'application doit d'abord être installée (iOS), l'option MUST l'expliquer au lieu d'échouer.

#### Scenario: Activation accordée
- **WHEN** l'utilisateur active les notifications et accepte l'autorisation du navigateur
- **THEN** l'appareil est enregistré et l'option apparaît activée

#### Scenario: Autorisation refusée
- **WHEN** l'utilisateur refuse l'autorisation du navigateur
- **THEN** rien n'est enregistré et l'option explique comment réautoriser dans le navigateur

#### Scenario: Navigateur non compatible
- **WHEN** le navigateur ne gère pas les notifications push
- **THEN** l'option est désactivée avec une explication

### Requirement: Notification d'une alerte déclenchée
Quand un import déclenche une ou plusieurs alertes pour un compte, chaque appareil où les notifications sont activées MUST recevoir une seule notification par import, même application fermée. La notification nomme la carte et son prix s'il n'y a qu'une alerte, sinon elle indique le nombre d'alertes. Elle est rédigée dans la langue choisie lors de l'activation. Toucher la notification MUST ouvrir la liste de souhaits. Une alerte qui suit simplement le prix ou qui s'efface MUST ne rien notifier.

#### Scenario: Une alerte
- **WHEN** l'import déclenche une alerte pour « V: Streetkid » à 4,80 € sur un compte avec un appareil abonné
- **THEN** l'appareil reçoit une notification nommant la carte et le prix

#### Scenario: Plusieurs alertes
- **WHEN** l'import déclenche 3 alertes pour le même compte
- **THEN** chaque appareil abonné reçoit une seule notification « 3 cartes ont atteint votre prix cible »

#### Scenario: Ouverture
- **WHEN** l'utilisateur touche la notification
- **THEN** l'application s'ouvre sur la liste de souhaits

### Requirement: Fiabilité des envois
Un abonnement que le service push déclare expiré ou invalide MUST être supprimé. L'échec d'un envoi MUST ne bloquer ni l'import des prix ni les autres envois. Supprimer le compte MUST supprimer tous ses abonnements, et la déconnexion MUST supprimer l'abonnement de l'appareil.

#### Scenario: Abonnement expiré
- **WHEN** le service push répond qu'un abonnement n'existe plus
- **THEN** cet abonnement est supprimé et les autres envois continuent

#### Scenario: Déconnexion
- **WHEN** l'utilisateur se déconnecte sur un appareil abonné
- **THEN** cet appareil ne reçoit plus de notification pour ce compte
