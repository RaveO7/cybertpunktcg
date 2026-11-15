# Polyfills signalés par Lighthouse et browserslist (2026-11-15)

## Constat (Next 16.3.6, build local)
- Les polyfills cités viennent de `next/dist/build/polyfills/polyfill-module.js`. Le fichier pèse 1 380 octets minifiés, environ 0,6 Kio compressés. Il est importé sans condition par `next/dist/client/app-globals.js` (l. 6) et se retrouve dans le chunk principal. Chaque ligne est gardée par `X || (X = …)`, donc rien ne s'exécute sur un navigateur récent.
- Le core-js 3.38 du build (`polyfill-nomodule`, 112 Kio) est servi en `<script noModule>`. Les navigateurs modernes ne le chargent pas et Lighthouse ne le compte pas.
- Les 14 Kio annoncés sont une estimation de Lighthouse par polyfill détecté. Le coût réel est d'environ 0,6 Kio compressé.
- Sans browserslist, Next cible déjà `chrome 111, edge 111, firefox 111, safari 16.4` (`shared/lib/modern-browserslist-target.js`).
- Un browserslist ne change que la transpilation SWC et le CSS, pas `polyfill-module` : aucun code de `dist/build` ni de `dist/client` ne le conditionne. Aucune option documentée ne le retire.

## Options
| Option | Gain réel | Lighthouse | Navigateurs perdus | Risque |
|---|---|---|---|---|
| A. browserslist plus moderne | 0 sur ces polyfills | Avertissement inchangé | Aucun de plus que la cible de Next | Aucun, mais inutile |
| B. Alias Turbopack de `polyfill-module` vers une version allégée (garder `URL.canParse`) | ≈ 0,6 Kio compressé | Avertissement supprimé | Chrome < 93, Safari/iOS < 15.4, Samsung < 17 : 0,87 % mondial, déjà hors cible officielle de Next | Contournement non documenté, à revérifier à chaque mise à jour de Next ; prise en compte d'un `require` interne à Next non vérifiée |
| C. Ne rien faire | 0 | Avertissement inchangé | Aucun | Aucun |

## Décision (2026-11-15) : C, ne rien faire
C : le gain réel est négligeable (≈ 0,6 Kio, aucune exécution). B touche à l'intérieur de Next, sans support.
TWA : Chrome Android reste au moins en 138 même sur Android 8 et 9, donc aucune perte côté Play Store, quelle que soit l'option.

## Couverture (caniuse-lite 1.0.30001812)
- Chrome/Edge < 93, Safari/iOS < 15.4, Firefox < 92, Samsung < 17 : 0,87 % mondial, dont iOS < 15.4 à 0,21 %.
- Sous la cible par défaut de Next (Chrome < 111, Safari < 16.4…) : 2,34 % mondial.

## Sources
- `node_modules/next/dist/docs/03-architecture/supported-browsers.md`, `dist/build/get-supported-browsers.js`, `dist/client/app-globals.js`
- caniuse Array.at : https://caniuse.com/mdn-javascript_builtins_array_at
- StatCounter mobile, octobre 2026 : https://gs.statcounter.com/browser-version-market-share/mobile/worldwide
- Chrome 139 exige Android 10 : https://9to5google.com/2025/06/26/google-chrome-android-versions-no-longer-supported-2025/
- TWA : https://developer.chrome.com/docs/android/trusted-web-activity
