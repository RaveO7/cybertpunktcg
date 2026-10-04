type ConditionLike = { code: string; name: string };

// Libellé d'option « CODE — Nom » dont le code est complété par des espaces insécables
// pour que les noms soient alignés en colonne (à afficher en police à chasse fixe).
export function conditionOptionLabel(condition: ConditionLike, conditions: ConditionLike[]): string {
  const width = Math.max(0, ...conditions.map((entry) => entry.code.length));
  return `${condition.code.padEnd(width, " ")} — ${condition.name}`;
}
