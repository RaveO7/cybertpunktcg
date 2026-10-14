/**
 * Exécuté dans le <head> (cf. SiteShell), avant le premier affichage : masque les blocs de l'accueil
 * à révéler au défilement (`data-reveal`, sans effet sur les autres pages), sans flash. Si
 * RevealDirector ne prend pas le relais en 4 s (script en échec), tout redevient visible.
 */
export const REVEAL_BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("reveal-ready");setTimeout(function(){if(!d.classList.contains("reveal-active"))d.classList.remove("reveal-ready")},4000)})();`;
