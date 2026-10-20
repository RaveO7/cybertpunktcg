## ADDED Requirements

### Requirement: Modifications hors ligne
Quand l'appareil est hors ligne, ou qu'une requête de modification échoue faute de réseau, l'ajout d'une ligne de collection, la modification d'une ligne (quantité, état, notes, prix d'achat) et sa suppression MUST être appliqués immédiatement à l'écran et enregistrés sur l'appareil, au lieu d'afficher une erreur. Ils sont alors marqués « en attente ». Les opérations groupées (ajout en lot, import CSV) et la suppression du compte MUST continuer à exiger le réseau et l'expliquer.

#### Scenario: Ajout hors ligne
- **WHEN** l'utilisateur ajoute 2 exemplaires d'une carte sans réseau
- **THEN** la carte apparaît possédée en 2 exemplaires et marquée en attente, sans message d'erreur

#### Scenario: Import hors ligne
- **WHEN** l'utilisateur lance un import CSV sans réseau
- **THEN** l'import est refusé avec un message indiquant qu'il faut être en ligne

### Requirement: Persistance de la file
Les modifications en attente MUST survivre à la fermeture de l'onglet, à un rechargement et au redémarrage de l'application installée. Elles MUST être réappliquées sur la collection affichée, y compris celle chargée depuis le cache hors ligne, tant qu'elles n'ont pas été envoyées. Elles sont propres au compte qui les a faites. Un autre compte connecté sur l'appareil MUST ne pas les voir ni les envoyer.

#### Scenario: Rechargement hors ligne
- **WHEN** l'utilisateur modifie une quantité hors ligne puis recharge l'application, toujours hors ligne
- **THEN** la quantité modifiée est toujours affichée et marquée en attente

### Requirement: Synchronisation au retour du réseau
Au retour du réseau, et à chaque ouverture de l'application en ligne, les modifications en attente MUST être envoyées au serveur une par une, dans l'ordre où elles ont été faites. Une ligne créée hors ligne puis modifiée ou supprimée hors ligne MUST aboutir au même état que si tout avait été fait en ligne. Une fois la file vide, la collection affichée MUST correspondre à celle du serveur.

#### Scenario: Ajout puis modification hors ligne
- **WHEN** l'utilisateur ajoute une carte hors ligne, change sa quantité de 1 à 3, puis retrouve le réseau
- **THEN** le serveur enregistre une seule ligne de 3 exemplaires et le marqueur « en attente » disparaît

#### Scenario: Ajout puis suppression hors ligne
- **WHEN** l'utilisateur ajoute puis supprime une carte hors ligne
- **THEN** rien n'est créé sur le serveur au retour du réseau

### Requirement: Échecs de synchronisation
Une modification que le serveur refuse définitivement (ligne supprimée ailleurs, carte retirée, données invalides) MUST être retirée de la file. La collection affichée revient alors à l'état du serveur, et l'utilisateur voit un message qui nomme la carte concernée. Une session expirée MUST garder la file intacte jusqu'à la reconnexion du même compte. Une erreur temporaire (réseau, erreur serveur 5xx) MUST garder la modification en file et réessayer plus tard.

#### Scenario: Ligne supprimée sur un autre appareil
- **WHEN** une modification en attente vise une ligne supprimée entre-temps depuis un autre appareil
- **THEN** la modification est abandonnée et l'utilisateur est informé, avec le nom de la carte

#### Scenario: Session expirée
- **WHEN** la synchronisation reçoit un refus de session
- **THEN** les modifications restent en attente et sont envoyées après la reconnexion du même compte

### Requirement: Indicateur des modifications en attente
L'application MUST afficher le nombre de modifications en attente tant que la file n'est pas vide, et indiquer quand la synchronisation est en cours. Se déconnecter avec des modifications en attente MUST demander une confirmation, car elles seront perdues.

#### Scenario: Indicateur
- **WHEN** 3 modifications sont en attente
- **THEN** l'en-tête de l'application indique « 3 modifications en attente »

#### Scenario: Déconnexion avec file non vide
- **WHEN** l'utilisateur se déconnecte avec des modifications en attente
- **THEN** une confirmation l'avertit qu'elles seront perdues
