## ADDED Requirements

### Requirement: Correspondance de la recherche
La recherche de cartes de l'application (explorateur, ajout en mode collection, navigateur de cartes des decks) MUST découper la saisie en mots et ne garder que les tirages qui correspondent à tous les mots. Un mot correspond s'il apparaît dans le nom, le sous-titre, le nom localisé, l'extension ou le texte de règles, sans tenir compte des accents, de la casse ni de la ponctuation. Un mot qui ressemble à un numéro de collection MUST continuer à être comparé au numéro du tirage, comme aujourd'hui.

#### Scenario: Accents et casse
- **WHEN** l'utilisateur cherche « netrunner » ou « NETRUNNER »
- **THEN** les cartes dont le nom contient « Netrunner » sont listées

#### Scenario: Numéro
- **WHEN** l'utilisateur cherche « 012 »
- **THEN** le tirage numéro 12 est listé et pas les cartes dont le texte contient « 012 »

### Requirement: Tolérance aux fautes de frappe
Quand un mot de 5 caractères ou plus ne correspond exactement à aucun mot des noms d'un tirage, il MUST correspondre à un mot du nom, du sous-titre ou du nom localisé qui en diffère d'une lettre au plus (ajout, retrait, remplacement ou inversion de deux lettres voisines). Pour un mot de 9 caractères ou plus, la différence peut aller jusqu'à deux lettres. Les mots de moins de 5 caractères et le texte de règles MUST rester en correspondance exacte, pour ne pas noyer les résultats.

#### Scenario: Faute d'une lettre
- **WHEN** l'utilisateur cherche « strretkid »
- **THEN** « V: Streetkid » figure dans les résultats

#### Scenario: Mot court
- **WHEN** l'utilisateur cherche « jhon » (4 caractères)
- **THEN** aucune correspondance approchée n'est appliquée

### Requirement: Classement par pertinence
Quand une recherche est saisie et que l'utilisateur n'a pas choisi d'autre tri que le tri par défaut, les résultats MUST être classés par pertinence décroissante : nom identique à la saisie, puis nom qui commence par la saisie, puis tous les mots trouvés dans le nom, puis correspondance approchée, puis correspondance dans le texte de règles seulement. À pertinence égale, l'ordre par défaut s'applique. Quand l'utilisateur choisit explicitement un tri, ce tri MUST s'appliquer. Sans saisie, l'ordre reste inchangé.

#### Scenario: Nom avant texte de règles
- **WHEN** l'utilisateur cherche un mot présent dans le nom d'une carte A et dans le texte de règles d'une carte B
- **THEN** la carte A est listée avant la carte B

#### Scenario: Tri choisi
- **WHEN** l'utilisateur a choisi le tri par prix et saisit une recherche
- **THEN** les résultats restent triés par prix

### Requirement: Réactivité de la recherche
La recherche MUST mettre à jour les résultats pendant la saisie sans bloquer l'interface, sur l'ensemble du catalogue, sur un mobile d'entrée de gamme.

#### Scenario: Saisie rapide
- **WHEN** l'utilisateur tape rapidement un mot dans l'explorateur
- **THEN** les caractères s'affichent sans saccade et les résultats suivent la dernière saisie
