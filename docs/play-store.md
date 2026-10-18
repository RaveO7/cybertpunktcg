# Publier l'app sur le Play Store (TWA)

L'app Android est une **Trusted Web Activity** : une coque Android qui ouvre le site en plein écran avec
le moteur de Chrome. Le site reste la seule source : chaque déploiement Vercel met l'app à jour, sans
republier sur le Play Store (sauf changement d'icône, de nom, de couleurs ou de domaine).

## Ce que le site fournit déjà

| Exigence | Où |
|---|---|
| Manifeste (nom, icônes 192/512 + maskable, `standalone`, couleurs) | `src/app/[locale]/manifest.webmanifest/route.ts` |
| Page hors ligne | `public/sw.js` |
| Lien entre l'app et le site | `src/app/.well-known/assetlinks.json/route.ts` (variables d'environnement) |
| Suppression du compte dans l'app | Paramètres → « Supprimer mon compte » (`DELETE /api/auth/account`) |
| URL publique de suppression du compte | `/fr/confidentialite`, section « Supprimer votre compte » |
| Politique de confidentialité | `/fr/confidentialite` |

## 1. Générer le projet Android (une fois)

Prérequis : Node.js, puis `npm i -g @bubblewrap/cli` (Bubblewrap télécharge lui-même le JDK et le SDK Android).

```sh
mkdir tcg-tracker-android && cd tcg-tracker-android
bubblewrap init --manifest=https://cybertpunktcg.vercel.app/fr/manifest.webmanifest
```

Garder ce dossier **hors du dépôt** (il contient la clé de signature). Réponses conseillées :

- **Application ID** : `app.vercel.cybertpunktcg.twa`. Il ne pourra plus changer une fois publié.
- **Display mode** : `standalone`.
- **Status bar / navigation bar color** : `#07080D`.
- **Signing key** : laisser Bubblewrap en créer une, et **la sauvegarder avec son mot de passe**. Sans elle,
  plus aucune mise à jour possible (sauf si la signature d'application Google Play est activée, ce qui est le cas par défaut).

Puis vérifier dans `twa-manifest.json` que la barre de navigation Android reste sombre, quel que soit le thème du téléphone :

```json
"themeColor": "#07080D",
"themeColorDark": "#07080D",
"navigationColor": "#07080D",
"navigationColorDark": "#07080D",
"navigationDividerColor": "#07080D",
"navigationDividerColorDark": "#07080D",
"backgroundColor": "#07080D"
```

Puis `bubblewrap update` (si le fichier a été modifié) et `bubblewrap build` : on obtient `app-release-bundle.aab`.

## 2. Relier l'app au site (assetlinks.json)

1. Dans la Play Console, créer l'app, puis aller dans **Test et publication → Configuration → Intégrité de l'application**.
2. Relever les deux empreintes **SHA-256** : celle de la **clé de signature d'application** (Google) et celle
   de la **clé d'importation** (la tienne, aussi affichée par `bubblewrap fingerprint list`).
3. Dans Vercel → Settings → Environment Variables (Production) :
   - `ANDROID_PACKAGE_NAME` = `app.vercel.cybertpunktcg.twa`
   - `ANDROID_CERT_SHA256` = `AA:BB:…,CC:DD:…` (les deux empreintes, séparées par une virgule)
4. Redéployer (la route est générée au build), puis vérifier :
   `https://cybertpunktcg.vercel.app/.well-known/assetlinks.json` doit renvoyer le package et les empreintes.

Si l'app installée affiche une barre d'adresse en haut, c'est que ce fichier ne correspond pas à la clé
de signature.

## 3. Fiche Play Store

- **Politique de confidentialité** : `https://cybertpunktcg.vercel.app/fr/confidentialite`
- **Suppression du compte** (Contenu de l'appli → Sécurité des données) :
  `https://cybertpunktcg.vercel.app/fr/confidentialite` (section « Supprimer votre compte »)
- **Sécurité des données** : e-mail, nom affiché, contenu créé par l'utilisateur (collection, decks) ;
  données chiffrées en transit ; suppression possible ; pas de partage avec des tiers ; pas de publicité.
- **Adresse e-mail de contact** : obligatoire dans la Console. Renseigner aussi `SITE.contactEmail` dans
  `src/lib/site.ts` pour qu'elle apparaisse dans les pages légales.
- **Captures d'écran** : au moins 2 captures téléphone ; icône 512×512 (`public/icons/icon-512.png`) ;
  image de présentation 1024×500.
- **Compte personnel récent** : Google exige un test fermé avec au moins 12 testeurs pendant 14 jours
  avant la mise en production.

## À savoir

- **Domaine** : l'app est liée à `cybertpunktcg.vercel.app`. Passer à un autre domaine impose de
  régénérer l'app (nouvel `host` dans `twa-manifest.json`) et de publier une mise à jour.
- **Liens externes** (Cardmarket, Google/Apple pendant la connexion) : ils s'ouvrent dans un onglet Chrome
  par-dessus l'app, puis l'app reprend la main. C'est normal.
- **Mise à jour de la coque** (icône, couleurs, nom) : incrémenter `appVersionCode` dans
  `twa-manifest.json`, `bubblewrap update && bubblewrap build`, puis importer le nouveau `.aab`.
