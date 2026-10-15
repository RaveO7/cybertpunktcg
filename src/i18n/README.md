# Traductions du site

Le site est servi en cinq langues (français, anglais, allemand, espagnol, italien) avec
[`next-intl`](https://next-intl.dev). Le français est la langue par défaut (URL sans préfixe) et la
**langue de référence** des textes : les types TypeScript et les tests en dérivent.

| Fichier | Rôle |
| --- | --- |
| `config.ts` | Registre des langues : code, nom affiché, format régional, locale Open Graph, pays. |
| `routing.ts` | URL de chaque page dans chaque langue (`pathnames`), préfixes. |
| `navigation.ts` | `Link`, `useRouter`, `usePathname`, `getPathname` localisés. |
| `request.ts` | Langue de la requête et chargement des messages (côté serveur). |
| `load.ts` | Lecture des blocs et repli : langue demandée → anglais → français. |
| `messages/<langue>/<bloc>.json` | Textes, un fichier par bloc (zone de l'interface) et par langue. |
| `messages/fr/index.ts` | Liste des blocs de référence (une ligne d'import par bloc). |
| `cards/<langue>.json` | Traductions du texte de règles des cartes (allemand, espagnol, italien). |
| `GLOSSARY.md` | Termes de jeu par langue, à respecter dans toutes les traductions. |

## Format des textes

Les textes sont des messages [ICU](https://next-intl.dev/docs/usage/messages) :

- variable : `"Classeur de {name}"` → `t("share.title", { name })` ;
- pluriel : `"{n, plural, one {# carte} other {# cartes}}"` → `t("decks.resultCount", { n })` ;
- choix : `"{color, select, Red {rouges} Blue {bleues} other {…}}"` ;
- accolades littérales (mots-clés de jeu comme `{Go Solo}`) dans un message lu avec `t()` : à
  entourer d'apostrophes, `'{Go Solo}'`. Les contenus structurés lus avec `t.raw()` (règles, tutoriel)
  ne sont pas interprétés : les accolades y restent telles quelles.

Dans un composant client : `const t = useTranslations("bloc")` ; dans un composant serveur ou des
métadonnées : `const t = await getTranslations("bloc")`. Dates, prix et nombres :
`useFormatter()` / `getFormatter()` (format régional de la langue).

## Modifier un texte

Modifier la valeur dans `messages/<langue>/<bloc>.json`. Seule cette langue change.

## Ajouter une clé

1. L'ajouter dans `messages/fr/<bloc>.json` (référence).
2. L'ajouter, traduite, dans le même bloc de chaque autre langue (`en`, `de`, `es`, `it`), avec les
   **mêmes variables**.
3. L'utiliser : `t("cle")`. TypeScript refuse une clé absente de la référence française.
4. Vérifier : `npx vitest run tests/unit/i18n-messages.test.ts`.

Tant qu'une langue n'a pas la clé, la page affiche le texte anglais (puis français), un
avertissement apparaît en développement et le test de cohérence échoue.

## Supprimer une clé

La retirer du bloc de **chaque** langue (le test signale une clé en trop), puis de son utilisation
dans le code (`npm run typecheck` signale les usages restants).

## Ajouter un bloc

1. Créer `messages/<langue>/<bloc>.json` pour chaque langue.
2. Ajouter la ligne d'import dans `messages/fr/index.ts`.
3. Si le bloc est lu par des composants clients présents sur toutes les pages, l'ajouter à
   `CLIENT_BLOCKS` (`src/i18n/client-messages.ts`) ; sinon, le transmettre seulement aux pages qui
   l'utilisent (voir les pages de règles).

Les blocs d'un dossier (`messages/<langue>/rules/*.json`) forment un espace de noms
(`rules.howToPlay`) ; un nouveau dossier se déclare dans `BLOCK_GROUPS` (`load.ts`).

## Ajouter une langue

1. Ajouter une entrée dans `LANGUAGES` (`config.ts`) : code, nom affiché, format régional, locale
   Open Graph, pays.
2. Créer `messages/<code>/` avec tous les blocs (copier `en/` puis traduire).
3. Ajouter l'URL de cette langue à chaque route traduite de `pathnames`, et ses ancres d'annuaire
   dans `landingSections` (`routing.ts`).
4. Optionnel : `cards/<code>.json` pour le texte des cartes.
5. Lancer les vérifications ci-dessous.

Aucune page ni route à créer : la langue apparaît dans le sélecteur, le sitemap, les balises
`hreflang` et les images de partage.

## Traduire le texte d'une carte

`cards/<langue>.json` associe à chaque carte (slug) le texte anglais traduit et sa traduction :

```json
{ "v-streetkid": { "source": "<texte anglais de la base>", "text": "<traduction>" } }
```

La traduction n'est affichée que si `source` est identique au texte anglais actuel de la carte ;
sinon la fiche affiche l'anglais et le signale. Conserver les mots-clés `{…}`, les affiliations en
majuscules et les nombres. `npx tsx scripts/check-card-translations.ts` liste les cartes sans
traduction ou dont la traduction est périmée (lecture seule).

## Vérifications

```sh
npx vitest run tests/unit/i18n-messages.test.ts   # blocs, clés, variables, ICU
npm run typecheck                                  # clés utilisées dans le code
npm test                                           # tous les tests
```
