# Collection Cyberpunk TCG

Outil local pour consulter les cartes officielles et suivre une collection.

Les cartes viennent de la même API que [cyberpunktcg.com/cards](https://cyberpunktcg.com/cards) (`api.netdeck.gg`). Le set principal s'appelle **Welcome to Night City — Retail**, pas « Extension 001 » : ce nom n'existe pas dans la base officielle. Les autres sets déjà publiés (beta, promos, starters, français) sont importés comme des extensions distinctes.

## Lancer

```bash
npm install
npm run import:cards
npm run dev
```

`npm run import:cards` crée la base SQLite, importe les cartes et télécharge les images. Les URL d'images officielles expirent, donc elles sont copiées dans `public/card-images`. Relancer la commande met à jour le catalogue sans effacer les collections.

La collection est liée à un compte (e-mail et mot de passe, ou Google / Apple). La session est un cookie qui dure environ un an et se renouvelle à chaque ouverture : sur téléphone, il n'y a pas à se reconnecter à chaque visite. Une collection déjà présente dans ce navigateur est rattachée au compte à la création du compte, ou ajoutée au compte au moment de la connexion.

### Connexion Google / Apple

Les boutons apparaissent seulement si les variables d'environnement correspondantes sont définies. Ajoutez-les dans `.env` (voir `.env.example`) :

- **Google** : créez un client OAuth « Application Web » dans Google Cloud Console, avec l'URI de redirection `https://votre-domaine/api/auth/oauth/google/callback` (et `http://localhost:3000/...` en local). Renseignez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
- **Apple** : dans Apple Developer, activez Sign in with Apple sur un Services ID, avec la même forme d'URI de callback `/api/auth/oauth/apple/callback`. Renseignez `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` et `APPLE_PRIVATE_KEY` (clé `.p8`, avec `\n` pour les retours à la ligne si besoin).
- `APP_URL` : origine publique de l'app (`http://localhost:3000` en local), utilisée pour construire les redirections OAuth.
- `OAUTH_STATE_SECRET` (recommandé) : secret pour signer le paramètre `state` OAuth.

### Robustesse et suivi des erreurs

- **Limiteur de débit** (connexion, inscription) : compteurs stockés en base (table `RateLimit`), donc partagés entre toutes les instances Vercel. L'IP vient de `x-real-ip` / `x-forwarded-for`, lus automatiquement sur Vercel ; derrière un autre proxy, définir `TRUST_PROXY=1`. Les compteurs expirés sont purgés par le cron quotidien.
- **Entrées API** : validées par les schémas Zod de `src/lib/api-schemas.ts`. Une nouvelle route qui lit un corps JSON passe par `readJsonBody(request, schéma)`.
- **Alertes** : `ALERT_WEBHOOK_URL` (optionnel) = URL d'un webhook Discord ou Slack. Y sont envoyées les erreurs serveur non rattrapées (`src/instrumentation.ts`), chaque échec du cron de prix (avec le nombre d'échecs consécutifs, table `JobStatus`), son rétablissement, et un avertissement si le guide Cardmarket a plus de 3 jours. Sans cette variable, tout reste dans les logs Vercel.

Après avoir modifié le schéma Prisma, arrêtez le serveur de dev puis lancez `npx prisma generate` (le fichier moteur Prisma est parfois verrouillé tant que Node tourne).

Aucun prix de marché n'est inventé. Un prix d'achat peut être saisi sur une ligne de collection. La valeur marché reste vide tant que le guide Cardmarket n'est pas importé.

## Prix Cardmarket

```bash
npm run import:prices
```

La commande lit le catalogue singles, le catalogue scellés/lots s'il est présent, et le guide de prix Cardmarket. Elle enregistre le prix tendance en euros (cartes et produits scellés). Le tirage français reçoit le prix du tirage anglais du même numéro. Une carte sans tendance, ou dont l'extension ne peut pas être reconnue, reste sans prix. Relancer la commande remplace les prix Cardmarket déjà enregistrés. La date `createdAt` du guide est mémorisée : un guide déjà importé ou plus ancien est refusé sans rien modifier (`--force` pour passer outre).

À chaque lancement, les fichiers sont téléchargés automatiquement depuis le serveur de fichiers Cardmarket et enregistrés dans `data/cardmarket/` :

- [Singles](https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_23.json)
- [Scellés / lots](https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_23.json)
- [Guide de prix](https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_23.json)

Si le téléchargement échoue, la commande utilise les fichiers déjà présents dans `data/cardmarket/`. `--offline` force l'utilisation de ces fichiers sans rien télécharger.

Pages utiles : [Product List](https://www.cardmarket.com/fr/Cyberpunk/Data/Product-List), [Price Guide](https://www.cardmarket.com/fr/Cyberpunk/Data/Price-Guide).

### Import quotidien automatique

Sous Windows, la tâche planifiée « CyberpunkTCG - Import prix » lance [scripts/import-prices-daily.cmd](scripts/import-prices-daily.cmd) tous les jours à 7 h 00 (rattrapée au démarrage si le PC était éteint). La sortie de chaque exécution est ajoutée à `data/import-prices.log`. Un guide déjà importé est simplement ignoré.

Les chemins peuvent aussi être passés explicitement : `npm run import:prices -- --products chemin.json --prices chemin.json --nonsingles chemin.json`.
