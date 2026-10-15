/**
 * Contenus de règles : les textes viennent des blocs de traductions (src/i18n/messages/<langue>/rules/),
 * les données non traduisibles (identifiants, zones, bonnes réponses, cartes d'exemple, liens) restent
 * ici, dans des arbres de même forme. `withData` les réunit : tableaux alignés par position, objets
 * fusionnés clé par clé (null : élément sans donnée).
 */
export function withData<T>(text: unknown, data: unknown): T {
  if (data === undefined || data === null) return text as T;
  if (Array.isArray(data)) {
    const items = Array.isArray(text) ? text : [];
    return items.map((item, index) => withData(item, data[index])) as T;
  }
  if (typeof data === "object") {
    const base = text && typeof text === "object" ? (text as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(data)) merged[key] = withData(base[key], value);
    return merged as T;
  }
  return data as T;
}
