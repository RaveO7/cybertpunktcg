import { gunzipSync } from "node:zlib";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Ctx, PriceFiles } from "./types";

const DOWNLOAD_BASE = "https://downloads.s3.cardmarket.com/productCatalog";
const DEFAULT_GAME_ID = 23;
const HEADERS = {
  accept: "application/json,text/plain,*/*",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  referer: "https://www.cardmarket.com/fr/Cyberpunk/Data/Price-Guide",
};

export async function resolveFiles(ctx: Ctx, offline: boolean): Promise<PriceFiles> {
  if (offline) {
    const cached = await cachedFiles(ctx);
    if (!cached) throw new Error(`Aucun fichier Cardmarket en cache dans ${ctx.cacheDir}.`);
    return cached;
  }
  let id: number;
  try {
    id = await downloadCyberpunk(ctx);
  } catch (error) {
    const cached = await cachedFiles(ctx);
    if (!cached) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    ctx.log(`Téléchargement impossible (${detail}). Utilisation des fichiers en cache.`);
    return cached;
  }
  const nonsingles = path.join(ctx.cacheDir, `products_nonsingles_${id}.json`);
  return {
    products: path.join(ctx.cacheDir, `products_singles_${id}.json`),
    prices: path.join(ctx.cacheDir, `price_guide_${id}.json`),
    // Optionnel : son téléchargement a pu échouer sans copie en cache → import sans les scellés.
    nonsingles: (await fileExists(nonsingles)) ? nonsingles : null,
  };
}

async function fileExists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function cachedFiles({ cacheDir }: Ctx): Promise<PriceFiles | null> {
  let entries: string[] = [];
  try {
    entries = await readdir(cacheDir);
  } catch {
    return null;
  }
  const products = pick(entries, ["products.json", "products_singles.json"], /^products_singles_.*\.json$/i, "catalogue singles");
  const prices = pick(entries, ["price-guide.json", "price_guide.json"], /^price_guide_.*\.json$/i, "guide de prix");
  const nonsingles = pickOptional(
    entries,
    ["products_nonsingles.json", "products-nonsingles.json"],
    /^products_nonsingles_.*\.json$/i,
  );
  if (products && prices) {
    // Cache runtime (tmpdir en prod) : empêche Turbopack de tracer tout le projet.
    return {
      products: path.join(/* turbopackIgnore: true */ cacheDir, products),
      prices: path.join(/* turbopackIgnore: true */ cacheDir, prices),
      nonsingles: nonsingles ? path.join(/* turbopackIgnore: true */ cacheDir, nonsingles) : null,
    };
  }
  return null;
}

function pick(entries: string[], preferred: string[], pattern: RegExp, label: string) {
  const named = preferred.find((name) => entries.includes(name));
  if (named) return named;
  const matches = entries.filter((name) => pattern.test(name)).sort();
  if (matches.length > 1) {
    throw new Error(`Plusieurs fichiers de ${label} dans le cache Cardmarket. Précisez --products et --prices.`);
  }
  return matches[0] ?? null;
}

function pickOptional(entries: string[], preferred: string[], pattern: RegExp) {
  const named = preferred.find((name) => entries.includes(name));
  if (named) return named;
  const matches = entries.filter((name) => pattern.test(name)).sort();
  return matches[0] ?? null;
}

async function downloadCyberpunk({ cacheDir }: Ctx) {
  const saved = await readSavedId(cacheDir);
  const first = saved ?? DEFAULT_GAME_ID;
  const candidates = [first, ...candidateIds().filter((id) => id !== first)];
  let blocked = false;
  for (const id of candidates) {
    const probe = await probeGame(id);
    if (probe === "blocked") {
      blocked = true;
      break;
    }
    if (probe !== "cyberpunk") continue;
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, `products_singles_${id}.json`), await download(productUrl(id)));
    await writeFile(path.join(cacheDir, `price_guide_${id}.json`), await download(priceUrl(id)));
    try {
      await writeFile(path.join(cacheDir, `products_nonsingles_${id}.json`), await download(nonsinglesUrl(id)));
    } catch {
      // optionnel : les scellés/lots peuvent être ajoutés à la main
    }
    await writeFile(path.join(cacheDir, "game-id.txt"), String(id));
    return id;
  }
  if (blocked) {
    throw new Error(
      [
        "Cardmarket refuse le téléchargement automatique.",
        `Enregistrez les fichiers JSON depuis votre navigateur dans ${cacheDir} :`,
        productUrl(DEFAULT_GAME_ID),
        nonsinglesUrl(DEFAULT_GAME_ID),
        priceUrl(DEFAULT_GAME_ID),
        "Puis relancez npm run import:prices -- --offline.",
      ].join("\n"),
    );
  }
  throw new Error("Le catalogue Cyberpunk est introuvable parmi les fichiers publics Cardmarket.");
}

function candidateIds() {
  const recent = Array.from({ length: 25 }, (_, index) => 40 - index);
  const older = Array.from({ length: 15 }, (_, index) => index + 1);
  return [...recent, ...older];
}

async function readSavedId(cacheDir: string) {
  try {
    const value = Number((await readFile(path.join(cacheDir, "game-id.txt"), "utf8")).trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function probeGame(id: number) {
  const response = await fetch(productUrl(id), {
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (response.status === 403 || response.status === 503) {
    // On ne lit le corps que pour libérer la connexion : son échec n'change pas le verdict « bloqué ».
    await response.arrayBuffer().catch(() => undefined);
    return "blocked";
  }
  if (!response.ok || !response.body) return "skip";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < 12000) {
    const step = await reader.read();
    if (step.done || !step.value) break;
    chunks.push(step.value);
    size += step.value.length;
  }
  // Annulation du flux restant : sans risque, les 12 premiers ko suffisent déjà au verdict.
  await reader.cancel().catch(() => undefined);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.includes("Just a moment") || text.includes("cf-browser-verification")) return "blocked";
  return /cyberpunk/i.test(text) ? "cyberpunk" : "skip";
}

async function download(url: string) {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString("utf8", 0, Math.min(bytes.length, 200));
  if (text.includes("Just a moment") || text.includes("<!DOCTYPE html")) {
    throw new Error("Cardmarket a renvoyé une page au lieu du fichier de prix.");
  }
  return bytes;
}

function productUrl(id: number) {
  return `${DOWNLOAD_BASE}/productList/products_singles_${id}.json`;
}

function nonsinglesUrl(id: number) {
  return `${DOWNLOAD_BASE}/productList/products_nonsingles_${id}.json`;
}

function priceUrl(id: number) {
  return `${DOWNLOAD_BASE}/priceGuide/price_guide_${id}.json`;
}

export async function readText(file: string) {
  const bytes = await readFile(file);
  const unzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return unzipped.toString("utf8");
}
