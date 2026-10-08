/** Palette tirée des cartes elles-mêmes : variables `--rarity-*` de globals.css (adaptées au thème clair). */
const RARITY_COLORS: Record<string, string> = {
  Common: "var(--rarity-common)",
  Uncommon: "var(--rarity-uncommon)",
  Rare: "var(--rarity-rare)",
  Epic: "var(--rarity-epic)",
  "Nova Rare": "var(--rarity-nova)",
  Secret: "var(--rarity-chrome)",
};

/** Iconic, la rareté la plus haute : reflet chromé traversé du jaune de l'onglet numéro des cartes. */
const ICONIC_STOPS = ["--rarity-chrome", "--rarity-nova", "--rarity-chrome"];

function iconicGradient(alpha = 100) {
  const stops = ICONIC_STOPS.map((name) =>
    alpha >= 100 ? `var(${name})` : `color-mix(in srgb, var(${name}) ${alpha}%, transparent)`,
  );
  return `linear-gradient(100deg, ${stops.join(", ")})`;
}

export const ICONIC_GRADIENT = iconicGradient();
/** Version atténuée pour les fonds de pastilles. */
export const ICONIC_GRADIENT_SOFT = iconicGradient(18);

export function isIconicRarity(rarity: string) {
  return rarity.startsWith("Iconic");
}

/** Couleur unie d'une rareté ; `null` si la rareté est inconnue. */
export function rarityColor(rarity: string): string | null {
  if (Object.hasOwn(RARITY_COLORS, rarity)) return RARITY_COLORS[rarity];
  return isIconicRarity(rarity) ? "var(--rarity-chrome)" : null;
}

/** Valeur CSS `background` d'une rareté (dégradé pour Iconic) ; `null` si la rareté est inconnue. */
export function rarityFill(rarity: string): string | null {
  return isIconicRarity(rarity) ? ICONIC_GRADIENT : rarityColor(rarity);
}
