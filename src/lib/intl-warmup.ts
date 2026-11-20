/**
 * Script de démarrage : prépare le moteur Intl du navigateur juste après le premier affichage.
 *
 * Le premier `Intl.NumberFormat` (ou `supportedLocalesOf`, appelé par chaque message traduit avec
 * variables) charge les données ICU : ~70 ms sur un mobile moyen, le premier `Intl.DateTimeFormat` ~15 ms
 * de plus. Sans ce script, ce coût tombait au milieu de l'hydratation et allongeait sa tâche déjà longue
 * (temps de blocage). Ici, chacun est payé dans une tâche courte à part, après le premier affichage
 * (requestAnimationFrame puis setTimeout) pour ne pas le retarder.
 */
export function intlWarmupScript(intlLocale: string) {
  const locale = JSON.stringify(intlLocale);
  return `(function(){if(typeof Intl==="undefined"||typeof requestAnimationFrame!=="function")return;requestAnimationFrame(function(){setTimeout(function(){new Intl.NumberFormat(${locale}).format(1);new Intl.PluralRules(${locale}).select(1)},0);setTimeout(function(){new Intl.DateTimeFormat(${locale}).format(0)},0)})})();`;
}
