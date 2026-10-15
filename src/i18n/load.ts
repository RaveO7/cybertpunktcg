import { DEFAULT_LOCALE, FALLBACK_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import reference from "@/i18n/messages/fr";

export type Messages = typeof reference;

type Tree = Record<string, unknown>;

/** Dossiers de blocs (« rules/howToPlay.json » → espace de noms rules.howToPlay). */
export const BLOCK_GROUPS: readonly string[] = ["rules"];

/** Chemins des fichiers de blocs, sans extension, d'après la référence française. */
export function blockFiles(messages: Tree = reference): string[] {
  return Object.keys(messages).flatMap((key) =>
    BLOCK_GROUPS.includes(key) ? Object.keys(messages[key] as Tree).map((sub) => `${key}/${sub}`) : [key],
  );
}

function isTree(value: unknown): value is Tree {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Fusion profonde : chaque couche complète les précédentes. Les objets sont fusionnés clé par clé ; les
 * textes et les tableaux (contenus structurés) sont remplacés en entier.
 */
export function mergeMessages(...layers: (Tree | undefined)[]): Tree {
  const result: Tree = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      result[key] = isTree(value) && isTree(result[key]) ? mergeMessages(result[key] as Tree, value) : value;
    }
  }
  return result;
}

/** Clés de `reference` absentes de `messages` (« bloc.clé »). */
export function missingKeys(reference: Tree, messages: Tree | undefined, prefix = ""): string[] {
  return Object.entries(reference).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const other = messages?.[key];
    if (isTree(value)) return missingKeys(value, isTree(other) ? other : undefined, path);
    return other === undefined ? [path] : [];
  });
}

function setPath(tree: Tree, path: string[], value: unknown) {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    tree[head] = value;
    return;
  }
  tree[head] ??= {};
  setPath(tree[head] as Tree, rest, value);
}

async function loadBlock(locale: Locale, file: string): Promise<Tree | undefined> {
  try {
    return (await import(`./messages/${locale}/${file}.json`)).default as Tree;
  } catch {
    return undefined;
  }
}

/** Un bloc dans chaque langue (avec repli sur le français), pour un composant affiché dans toutes les langues. */
export async function loadBlockInAllLocales<K extends keyof Messages>(block: K): Promise<Record<Locale, Messages[K]>> {
  const entries = await Promise.all(
    LOCALES.map(async (locale) => {
      const own = locale === DEFAULT_LOCALE ? reference[block] : await loadBlock(locale, block);
      return [locale, mergeMessages(reference[block] as Tree, own as Tree | undefined)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Locale, Messages[K]>;
}

/** Blocs d'une langue tels qu'écrits dans ses fichiers (sans repli). */
export async function loadLocaleMessages(locale: Locale): Promise<Tree> {
  if (locale === DEFAULT_LOCALE) return reference;
  const tree: Tree = {};
  await Promise.all(
    blockFiles().map(async (file) => {
      const block = await loadBlock(locale, file);
      if (block) setPath(tree, file.split("/"), block);
    }),
  );
  return tree;
}

const reported = new Set<Locale>();

/**
 * Messages d'une langue complétés par l'anglais puis par le français : un texte non traduit s'affiche
 * dans la première de ces langues qui l'a. Les manques sont signalés en développement.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === DEFAULT_LOCALE) return reference;
  const own = await loadLocaleMessages(locale);
  if (process.env.NODE_ENV === "development" && !reported.has(locale)) {
    reported.add(locale);
    const missing = missingKeys(reference, own);
    if (missing.length > 0) console.warn(`[i18n] ${missing.length} texte(s) sans traduction en « ${locale} » :`, missing.slice(0, 20));
  }
  const fallback = locale === FALLBACK_LOCALE ? undefined : await loadLocaleMessages(FALLBACK_LOCALE);
  return mergeMessages(reference, fallback, own) as Messages;
}
