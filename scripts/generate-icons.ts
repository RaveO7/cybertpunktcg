// Génère les icônes de la webapp (manifest PWA + écran d'accueil iOS) à partir d'un SVG.
// Usage : npx tsx scripts/generate-icons.ts
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BACKGROUND = "#07080d";
const YELLOW = "#f5e642";
const CYAN = "#3ee0ff";

// `scale` réduit le motif pour les icônes maskable (zone sûre = cercle de 80 %).
function iconSvg(scale: number) {
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <g transform="rotate(-8 256 256)">
      <path d="M150 70 H342 L382 110 V442 H170 L130 402 V90 Z" fill="none" stroke="${CYAN}" stroke-width="14" stroke-linejoin="miter" transform="translate(14 10)" opacity="0.85"/>
      <path d="M150 70 H342 L382 110 V442 H170 L130 402 V90 Z" fill="${BACKGROUND}" stroke="${YELLOW}" stroke-width="16" stroke-linejoin="miter"/>
      <rect x="168" y="112" width="176" height="10" fill="${YELLOW}"/>
      <rect x="168" y="386" width="120" height="10" fill="${CYAN}"/>
      <text x="256" y="288" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="84" fill="${YELLOW}" letter-spacing="-2">TCG</text>
    </g>
  </g>
</svg>`;
}

const root = path.resolve(__dirname, "..");
const targets = [
  { file: "public/icons/icon-192.png", size: 192, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1 },
  { file: "public/icons/maskable-512.png", size: 512, scale: 0.72 },
  { file: "src/app/apple-icon.png", size: 180, scale: 0.86 },
];

async function main() {
  for (const target of targets) {
    const output = path.join(root, target.file);
    await mkdir(path.dirname(output), { recursive: true });
    await sharp(Buffer.from(iconSvg(target.scale))).resize(target.size, target.size).png().toFile(output);
    console.log(`✓ ${target.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
