/**
 * Code d'extension du catalogue à partir de celui de netdeck.gg. L'application repère la version française
 * d'une extension par le suffixe « -fr » ajouté au code anglais (filtres de langue, decks, import CSV, prix
 * Cardmarket). netdeck écrit parfois « -FR » ou tronque le code anglais (« embracingpowerretailstarterde-fr ») :
 * ramené à « <code anglais>-fr ». `sourceCodes` : tous les codes reçus de netdeck.
 */
export function canonicalSetCode(code: string, sourceCodes: Iterable<string>) {
  const french = /^(.*)-fr$/i.exec(code);
  if (!french) return code;
  const base = french[1];
  const english = [...sourceCodes].filter((candidate) => !/-fr$/i.test(candidate));
  if (english.includes(base)) return `${base}-fr`;
  const truncated = english.filter((candidate) => candidate.startsWith(base));
  return `${truncated.length === 1 ? truncated[0] : base}-fr`;
}
