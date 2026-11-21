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

const HTML_EXCERPT = 500;
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
export function hydrationDiff(allServerElements: DomElement[], allCurrentElements: DomElement[]): string {
  const serverElements = allServerElements.filter(isContent);
  const currentElements = allCurrentElements.filter(isContent);
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
