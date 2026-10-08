// Génère les miniatures WebP des images de cartes (public/card-images/thumb/).
// Lancé automatiquement par `npm run build` et `npm run dev` ; les miniatures à jour sont ignorées.
// Usage : npx tsx scripts/generate-thumbnails.ts [--force]
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { THUMB_DIR, THUMB_WIDTH } from "../src/lib/card-image";

const SOURCE_DIR = path.join(process.cwd(), "public", "card-images");
const OUT_DIR = path.join(SOURCE_DIR, THUMB_DIR);
const CONCURRENCY = 8;
const force = process.argv.includes("--force");

async function isUpToDate(source: string, target: string) {
  if (force) return false;
  try {
    const [s, t] = await Promise.all([stat(source), stat(target)]);
    return t.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SOURCE_DIR)).filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f));

  let generated = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      const source = path.join(SOURCE_DIR, file);
      const target = path.join(OUT_DIR, `${file.replace(/\.[^.]+$/, "")}.webp`);
      if (await isUpToDate(source, target)) continue;
      try {
        await sharp(source)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toFile(target);
        generated++;
      } catch (error) {
        // Pas bloquant : le composant CardImage repasse sur l'image d'origine.
        failed++;
        console.warn(`Miniature impossible pour ${file} :`, (error as Error).message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(
    `Miniatures : ${generated} générée(s), ${files.length - generated - failed} à jour, ${failed} en échec.`,
  );
}

main().catch((error) => {
  // Le build continue sans miniatures : les images d'origine sont servies à la place.
  console.warn("Génération des miniatures interrompue :", error);
});
