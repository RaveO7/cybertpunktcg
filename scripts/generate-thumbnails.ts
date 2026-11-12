// Génère les miniatures WebP des images de cartes : public/card-images/thumb/ (THUMB_WIDTH) et
// thumb/<largeur>/ pour chaque largeur de THUMB_EXTRA_WIDTHS (srcset).
// Lancé automatiquement par `npm run build` et `npm run dev` ; les miniatures à jour sont ignorées.
// Cache entre deux builds (.next/cache, conservé par Vercel) : chaque miniature y est rangée sous
// l'empreinte du contenu de son image source, donc une image ajoutée ou modifiée est régénérée.
// Usage : npx tsx scripts/generate-thumbnails.ts [--force]
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, unlink, utimes } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { THUMB_DIR, THUMB_EXTRA_WIDTHS, THUMB_WIDTH } from "../src/lib/card-image";

const SOURCE_DIR = path.join(process.cwd(), "public", "card-images");
const OUT_DIR = path.join(SOURCE_DIR, THUMB_DIR);
const CACHE_DIR = path.join(process.cwd(), process.env.NEXT_DIST_DIR || ".next", "cache", "card-thumbnails");
const QUALITY = 78;
const OUTPUTS = [
  { width: THUMB_WIDTH, dir: OUT_DIR },
  ...THUMB_EXTRA_WIDTHS.map((width) => ({ width, dir: path.join(OUT_DIR, String(width)) })),
];
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

async function exists(file: string) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

async function main() {
  await Promise.all([...OUTPUTS.map(({ dir }) => mkdir(dir, { recursive: true })), mkdir(CACHE_DIR, { recursive: true })]);
  const sources = (await readdir(SOURCE_DIR)).filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f));
  const files = sources.flatMap((file) => OUTPUTS.map((output) => ({ file, ...output })));
  const hashes = new Map<string, Promise<string>>();
  const used = new Set<string>();

  let generated = 0;
  let restored = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const { file, width, dir } = files[next++];
      const source = path.join(SOURCE_DIR, file);
      const target = path.join(dir, `${file.replace(/\.[^.]+$/, "")}.webp`);
      try {
        if (!hashes.has(file)) hashes.set(file, readFile(source).then((data) => createHash("sha256").update(data).digest("hex")));
        const cached = path.join(CACHE_DIR, `${await hashes.get(file)}-${width}-q${QUALITY}.webp`);
        used.add(path.basename(cached));
        if (await isUpToDate(source, target)) continue;
        if (!force && (await exists(cached))) {
          await copyFile(cached, target);
          // La copie peut garder la date du cache : sans cela, la miniature paraîtrait périmée au prochain lancement.
          const now = new Date();
          await utimes(target, now, now);
          restored++;
          continue;
        }
        await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(target);
        await copyFile(target, cached);
        generated++;
      } catch (error) {
        // Pas bloquant : le composant CardImage repasse sur l'image d'origine.
        failed++;
        console.warn(`Miniature ${width} px impossible pour ${file} :`, (error as Error).message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Miniatures d'images supprimées ou modifiées depuis : le cache ne grossit pas indéfiniment.
  let pruned = 0;
  for (const entry of await readdir(CACHE_DIR)) {
    if (used.has(entry)) continue;
    await unlink(path.join(CACHE_DIR, entry)).catch(() => undefined);
    pruned++;
  }
  console.log(
    `Miniatures : ${generated} générée(s), ${restored} reprise(s) du cache, ${files.length - generated - restored - failed} à jour, ${failed} en échec` +
      (pruned ? `, ${pruned} retirée(s) du cache.` : "."),
  );
}

main().catch((error) => {
  // Le build continue sans miniatures : les images d'origine sont servies à la place.
  console.warn("Génération des miniatures interrompue :", error);
});
