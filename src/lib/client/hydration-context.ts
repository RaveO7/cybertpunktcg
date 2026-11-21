/**
 * Contexte d'une erreur d'hydratation React (#418) : en production, React ne dit pas quel élément
 * diffère entre le HTML du serveur et le rendu du navigateur, il reconstruit la page (ou la partie en
 * écart). On garde donc la liste des éléments du HTML serveur avant l'hydratation (copie d'une liste,
 * quasi gratuite), et en cas d'erreur on la compare, dans l'ordre du document, à celle d'après : le
 * premier élément qui diffère est l'endroit de l'écart.
 */

/** Élément du DOM, réduit à ce qui sert à le décrire (testable sans navigateur). */
export type DomElement = {
  tagName: string;
  id: string;
  classList: Iterable<string>;
  outerHTML: string;
  parentElement: DomElement | null;
};

const HTML_EXCERPT = 300;
// Balises que React ou Next placent eux-mêmes dans la page (scripts, styles, préchargements) : sans rapport
// avec un écart d'hydratation, elles décaleraient la comparaison.
const TECHNICAL_TAGS = new Set(["SCRIPT", "LINK", "STYLE", "TEMPLATE", "NOSCRIPT"]);

function isContent(element: DomElement) {
  return !TECHNICAL_TAGS.has(element.tagName);
}

export function isHydrationError(message: string) {
  return message.includes("#418") || /hydrat/i.test(message);
}

export function describeElement(element: DomElement) {
  const classes = [...element.classList].slice(0, 3).join(".");
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes}` : ""}`;
}

/** Chemin d'un élément depuis la racine de la page (`body > div.x > main…`). */
export function ancestry(element: DomElement) {
  const chain: string[] = [];
  for (let current: DomElement | null = element; current; current = current.parentElement) chain.unshift(describeElement(current));
  return chain.join(" > ");
}

/** Premier élément qui diffère entre le HTML serveur et la page après l'hydratation, côté serveur et côté navigateur. */
export function hydrationDiff(serverElements: DomElement[], currentElements: DomElement[]): string {
  const header = `éléments : serveur ${serverElements.length}, maintenant ${currentElements.length}`;
  const index = serverElements.findIndex((element, i) => {
    const current = currentElements[i];
    return current === undefined || describeElement(current) !== describeElement(element);
  });
  if (index === -1) return `${header}\naucun écart de structure`;
  const show = (element: DomElement | undefined) =>
    element ? `${ancestry(element)}\n${element.outerHTML.slice(0, HTML_EXCERPT)}` : "(aucun)";
  return `${header}\nécart à l'élément ${index}\n[serveur] ${show(serverElements[index])}\n[navigateur] ${show(currentElements[index])}`;
}

/** Éléments de la tête et du corps de la page, relevés avant l'hydratation puis après l'erreur. */
export type PageElements = { head: DomElement[]; body: DomElement[] };

const TAG_EXCERPT = 150;
const MAX_TAGS = 6;

/**
 * Balises disparues et apparues, sans tenir compte de l'ordre : React réordonne la tête (feuilles de style
 * en premier) et ajoute ses scripts, l'ordre n'y dit rien.
 */
export function tagsDiff(serverElements: DomElement[], currentElements: DomElement[]): string {
  const key = (element: DomElement) => element.outerHTML.slice(0, TAG_EXCERPT);
  const count = (elements: DomElement[]) => {
    const counts = new Map<string, number>();
    for (const element of elements) counts.set(key(element), (counts.get(key(element)) ?? 0) + 1);
    return counts;
  };
  const surplus = (from: Map<string, number>, other: Map<string, number>) =>
    [...from].filter(([html, n]) => n > (other.get(html) ?? 0)).map(([html]) => html);
  const server = count(serverElements);
  const current = count(currentElements);
  const list = (items: string[]) => (items.length ? items.slice(0, MAX_TAGS).join("\n") : "(aucune)");
  return `disparues :\n${list(surplus(server, current))}\napparues :\n${list(surplus(current, server))}`;
}

/**
 * Contexte joint au rapport : contenu du corps dans l'ordre (cas le plus parlant), puis balises techniques
 * du corps et balises de la tête, disparues ou apparues.
 */
export function hydrationReport(server: PageElements, current: PageElements): string {
  const technical = (elements: DomElement[]) => elements.filter((element) => !isContent(element));
  return [
    `[corps, contenu] ${hydrationDiff(server.body.filter(isContent), current.body.filter(isContent))}`,
    `[corps, balises techniques] ${tagsDiff(technical(server.body), technical(current.body))}`,
    `[tête] ${tagsDiff(server.head, current.head)}`,
  ].join("\n");
}
