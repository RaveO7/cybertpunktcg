# Design

## Context

Voir proposal.md (Why). État actuel utile :

- Vitest seul (`tests/unit`, `tests/db`). La garde SQLite existe déjà dans `tests/setup/local-db-only.ts` : elle charge `.env` sans écraser l'environnement et refuse toute `DATABASE_URL` hors `file:`.
- Next 16 : `next dev` écrit dans `.next/dev` et pose un **verrou** qui empêche un second `next dev` sur le même projet. Si l'utilisateur a déjà son serveur de dev lancé, Playwright ne peut pas en démarrer un autre avec la même configuration.
- Auth : `registerAccount()` et `createSession()` (`src/lib/auth.ts`) n'utilisent que Prisma. Le cookie s'appelle `cptcg_session` (`src/lib/session-cookie.ts`). Supprimer un `User` supprime ses sessions, sa collection et ses decks (cascade).
- Limiteur de débit : register 10/min, login 20/min, compteurs en base (`RateLimit`, clé `portée:IP`). Sans `TRUST_PROXY=1`, tous les appels partagent la clé `portée:local`, qui peut déjà exister et appartenir à l'utilisateur.
- Routes : préfixe de langue obligatoire (`/fr/...`). `/` affiche la landing sans cookie et le tableau de bord (collection) avec. `/comment-jouer` (tutoriel) et `/decks` demandent un compte. Le thème se règle dans `/parametres`.
- Tutoriel : l'appui long d'un doigt (pointeur non-souris, 400 ms) soulève la carte dans un calque fixe `.dm-lift`.
- Un service worker (`/sw.js`) gère le mode hors-ligne.

## Goals / Non-Goals

**Goals:**
- Lancer `npm run test:e2e` et obtenir, sans rien démarrer à la main, des tests verts ou rouges sur iPhone et Pixel émulés, ainsi que des captures relisibles.
- Que l'assistant (Claude) puisse lancer ces tests et lire les captures après chaque modification, avant tout push.
- Ne jamais laisser de trace en base et ne jamais toucher à des lignes existantes, y compris aux compteurs du limiteur.

**Non-Goals:**
- Régression visuelle par comparaison d'images (`toHaveScreenshot`) : trop instable avec des prix et des données locales qui changent.
- Couverture exhaustive : on vise les parcours qui cassaient sur téléphone, pas tous les écrans.
- Desktop : les tests desktop pourront s'ajouter plus tard sous forme d'un projet Playwright supplémentaire.

## Decisions

### 1. Playwright plutôt que Puppeteer ou un émulateur Android/iOS
Playwright embarque WebKit (moteur de Safari) en plus de Chromium, ainsi que des profils d'appareils prêts à l'emploi (`devices['iPhone 15']`, `devices['Pixel 7']` : viewport, DPR, `hasTouch`, `isMobile`, user-agent). Puppeteer ne couvre que Chromium. Un émulateur Android Studio ou un simulateur Xcode (indisponible sous Windows) serait lourd et difficile à piloter automatiquement.

Les deux projets Playwright `iphone` et `pixel` reprennent ces profils. On ajoute `colorScheme: 'light'` pour reproduire le cas qui posait problème, un téléphone en thème clair avec l'application sombre, et `serviceWorkers: 'block'` pour que le cache hors-ligne ne serve pas une version périmée pendant les tests.

### 2. Serveur dédié : port 3100, dossier de build séparé, `TRUST_PROXY=1`
`webServer` lance `next dev --port 3100` avec `NEXT_DIST_DIR=.next-e2e` et `TRUST_PROXY=1`. `next.config.ts` lit `distDir: process.env.NEXT_DIST_DIR || ".next"`, ce qui ne change rien quand la variable est absente. Avec son propre dossier, le serveur de test n'entre pas en conflit avec le verrou du `next dev` de l'utilisateur, qui peut continuer à tourner sur le port 3000.

- *Alternative écartée : réutiliser le serveur déjà lancé.* Il ne fait pas confiance à `x-forwarded-for`. Les connexions de test incrémenteraient donc le compteur `login:local` de l'utilisateur, ce qui revient à modifier des données existantes.
- *Alternative écartée : `next build` puis `next start`.* Plusieurs minutes de build à chaque lancement, trop lent pour vérifier une retouche.
- **À vérifier en premier pendant l'implémentation** : que le verrou est bien rangé dans le `distDir`. Si ce n'est pas le cas, on se replie sur un message clair (« arrête ton `next dev` avant de lancer les tests ») et la décision 4 protège quand même les compteurs.

`reuseExistingServer: true` réutilise un serveur de test déjà lancé sur 3100 pour accélérer les relances. Timeout de démarrage : 180 s, car la première compilation est lente.

### 3. Garde SQLite avant tout lancement
`playwright.config.ts` charge `.env` avec la même règle que `tests/setup/local-db-only.ts` et lève une erreur avant de démarrer le serveur si `DATABASE_URL` ne commence pas par `file:`. Le `globalSetup` refait la vérification par sécurité, puisque c'est lui qui ouvre Prisma.

### 4. Comptes créés directement en base, sans passer par l'API
Une fixture Playwright `account`, à portée **test**, procède ainsi :
1. `registerAccount({ email: "e2e.<runId>.<n>@example.com", … })` puis `createSession(user.id)` via Prisma.
2. Pose le cookie `cptcg_session` dans le contexte du navigateur.
3. Dans son teardown, qui s'exécute aussi en cas d'échec, appelle `prisma.user.delete({ where: { id } })`, ce qui supprime aussi ses données par cascade.

Ce chemin ne touche à aucun compteur du limiteur. Seul le test « connexion par l'écran » passe par `/api/auth/login`. Il envoie un `x-forwarded-for` propre au run (`e2e-<runId>`) et supprime ensuite exactement les clés `*:e2e-<runId>` qu'il a créées.

- *Alternative écartée : `/api/auth/register` à chaque test.* Elle serait limitée à 10 appels par minute et créerait des compteurs pour rien.

**Filet de sécurité** : le `globalTeardown` supprime les `User` dont l'e-mail commence par `e2e.<runId>.` et finit par `@example.com`, puis les `RateLimit` dont la clé finit par `:e2e-<runId>`. Il couvre aussi un processus de test tué en plein milieu. `runId` est généré par le `globalSetup` et transmis par variable d'environnement. Le filtre ne peut donc jamais atteindre un compte réel ni un autre run.

### 5. Données de catalogue : lecture seule
Le test de collection ajoute une carte au compte de test avec une impression déjà présente dans la base locale (`prisma.printing.findFirst`). Les lignes créées appartiennent au compte et partent avec lui. Si le catalogue local est vide, le test est marqué `skip` avec un message ; il ne crée pas de catalogue.

### 6. Appui long tactile
Playwright n'a pas d'API d'appui long. Le test envoie `pointerdown` avec `pointerType: 'touch'` sur la carte, attend 500 ms, vérifie que `.dm-lift` est visible, puis vérifie que son rectangle tient entièrement dans le viewport et n'est pas rogné par le plateau. Pour finir, il envoie `pointerup`. Le même code marche sur WebKit et Chromium, alors qu'un appui long via le protocole CDP serait limité à Chromium.

### 7. Captures : un helper explicite, hors comparaison
`snap(page, name)` enregistre `tests/e2e/screenshots/<projet>/<nom>.png` (page entière). Le dossier est vidé au début de chaque run et ignoré par git. Les traces Playwright sont gardées seulement en cas d'échec (`trace: 'retain-on-failure'`) dans `test-results/`.

### 8. Exécution : `workers: 1`, `retries: 0`
Une seule base SQLite et un seul serveur de dev qui compile à la demande : l'exécution en série évite les verrous SQLite et les timeouts de compilation. Pas de nouvelle tentative, pour qu'un test instable soit visible au lieu d'être masqué.

### 9. Organisation des fichiers
```
playwright.config.ts
tests/e2e/
  setup/global-setup.ts      garde SQLite, runId, vidage des captures
  setup/global-teardown.ts   filet de sécurité (comptes + compteurs du run)
  fixtures.ts                fixture `account`, helper `snap`
  session.spec.ts            connexion par l'écran, reprise après rechargement
  collection.spec.ts
  decks.spec.ts
  tutorial.spec.ts
  theme.spec.ts
```
Les specs importent `@/lib/...`. Playwright résout les `paths` de `tsconfig.json`.

## Risks / Trade-offs

- [WebKit sous Windows n'est pas Safari iOS] → Le moteur de rendu est le même, mais pas la barre d'adresse, l'encoche, le clavier virtuel ni l'installation en appli. Une vérification finale sur un vrai téléphone reste listée dans tasks.md.
- [Le verrou de `next dev` n'est peut-être pas lié au `distDir`] → À vérifier en premier (tâche 1.1). Le repli est décrit dans la décision 2.
- [Premier lancement lent : compilation, téléchargement des navigateurs d'environ 300 Mo] → `test:e2e:install` séparé, `reuseExistingServer`, timeouts larges.
- [`next.config.ts` modifié pour `distDir`] → Changement neutre sans la variable. Ajouter `.next-e2e` au `.gitignore`.
- [Tests dépendants du texte affiché ou de la langue] → Sélecteurs par rôle ou `data-*` existants en priorité, URL en `/fr` fixe.
- [Le client Prisma généré pour SQLite doit exister] → `predev` le génère. Le `globalSetup` échoue avec un message clair sinon.
- [Run entier tué avant le `globalTeardown`] → Le run suivant ne nettoie pas l'ancien `runId`. On documente la commande de nettoyage manuel (comptes `e2e.%@example.com`).
