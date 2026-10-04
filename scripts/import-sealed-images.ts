import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { isSealedSetCode } from "../src/lib/reference-data";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const IMAGE_DIR = path.join(ROOT, "public", "card-images");
const FORCE = process.argv.includes("--force");

type FoundImage = {
  image: string;
  title: string;
  page: string;
  width: number;
  height: number;
  source: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !["the", "to", "of", "and", "for", "set", "cyberpunk", "tcg"].includes(token));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function scoreImage(productName: string, row: FoundImage) {
  const name = normalize(productName);
  const title = normalize(row.title);
  const image = row.image.toLowerCase();
  const page = row.page.toLowerCase();
  const hay = `${title} ${image} ${page}`;
  let score = 0;
  const wanted = tokens(productName);
  let hits = 0;
  for (const token of wanted) {
    if (hay.includes(token)) hits += 1;
  }
  score += hits * 8;
  if (wanted.length > 0 && hits / wanted.length >= 0.7) score += 20;
  if (title.includes(name) || hay.includes(name)) score += 40;
  if (/booster|box|deck|kit|case|sealed|product/.test(hay)) score += 10;
  if (/bigcommerce|cdn\.shop|shopify|wp-content\/uploads|cyberpunktcg\.gg|starcitygames|ebayimg|gamersathart/.test(hay)) {
    score += 12;
  }
  if (/opening|vs\.|versus|guide|impressions|unboxing|reddit|ama|article|blog|review/.test(hay)) score -= 25;
  if (/cardnexus|single|card #|opengraph|avatar|logo|icon/.test(hay)) score -= 15;
  if (row.width >= 400 && row.height >= 400) score += 8;
  if (row.width >= 800 || row.height >= 800) score += 6;
  if (!/^https?:\/\//i.test(row.image)) score -= 100;
  return score;
}

async function duckVqd(query: string) {
  const response = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`ddg html ${response.status}`);
  const text = await response.text();
  const vqd = text.match(/vqd=(?:\\?"|')?([\d-]+)/)?.[1] ?? text.match(/vqd=([\d-]+)/)?.[1];
  if (!vqd) throw new Error("ddg vqd introuvable");
  return vqd;
}

async function duckImages(query: string): Promise<FoundImage[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const vqd = await duckVqd(query);
      await sleep(250 * attempt);
      const api = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`;
      const response = await fetch(api, {
        headers: {
          "user-agent": UA,
          accept: "application/json",
          referer: "https://duckduckgo.com/",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 403 || response.status === 429) {
        await sleep(1500 * attempt);
        throw new Error(`ddg i.js ${response.status}`);
      }
      if (!response.ok) throw new Error(`ddg i.js ${response.status}`);
      const data = (await response.json()) as {
        results?: { image?: string; title?: string; url?: string; width?: number; height?: number }[];
      };
      return (data.results ?? [])
        .filter((row) => row.image)
        .map((row) => ({
          image: row.image!,
          title: row.title ?? "",
          page: row.url ?? "",
          width: Number(row.width ?? 0),
          height: Number(row.height ?? 0),
          source: "duckduckgo",
        }));
    } catch (error) {
      lastError = error;
      await sleep(1200 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ddg failed");
}

async function bingImages(query: string): Promise<FoundImage[]> {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&tsc=ImageHoverTitle`;
  const response = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html",
      "accept-language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`bing ${response.status}`);
  const text = await response.text();
  const results: FoundImage[] = [];
  const re = /m="{&quot;murl&quot;:&quot;(https?:\\\/\\\/[^&]+?)&quot;[\s\S]*?&quot;t&quot;:&quot;([^&]*?)&quot;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) && results.length < 30) {
    const image = match[1]
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
    const title = match[2]
      .replace(/\\u0026/g, "&")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'");
    results.push({ image, title, page: "", width: 0, height: 0, source: "bing" });
  }
  // Fallback: mediaurl pattern
  if (results.length === 0) {
    const media = [...text.matchAll(/mediaurl=([^&"]+)/gi)].map((entry) => decodeURIComponent(entry[1]));
    for (const image of media.slice(0, 20)) {
      if (!/^https?:\/\//i.test(image)) continue;
      results.push({ image, title: query, page: "", width: 0, height: 0, source: "bing" });
    }
  }
  return results;
}

async function resolveBestImage(productName: string) {
  const queries = [`Cyberpunk TCG ${productName}`, `Cyberpunk TCG "${productName}" product`];
  const candidates: { row: FoundImage; score: number }[] = [];

  for (const query of queries) {
    try {
      const rows = await duckImages(query);
      for (const row of rows) candidates.push({ row, score: scoreImage(productName, row) });
      if (candidates.some((entry) => entry.score >= 45)) break;
    } catch {
      // fallback below
    }
    await sleep(900);
  }

  if (!candidates.some((entry) => entry.score >= 35)) {
    for (const query of queries.slice(0, 1)) {
      try {
        const rows = await bingImages(query);
        for (const row of rows) candidates.push({ row, score: scoreImage(productName, row) });
      } catch {
        // ignore
      }
      await sleep(700);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.filter((entry) => entry.score >= 18).slice(0, 8);
}

async function downloadImage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: "https://www.bing.com/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("image")) {
    throw new Error(`${response.status} ${type}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 2500) throw new Error(`image trop petite (${bytes.length})`);
  let ext = "jpg";
  if (type.includes("png") || /\.png(\?|$)/i.test(url)) ext = "png";
  else if (type.includes("webp") || /\.webp(\?|$)/i.test(url)) ext = "webp";
  else if (type.includes("jpeg") || type.includes("jpg") || /\.jpe?g(\?|$)/i.test(url)) ext = "jpg";
  return { bytes, ext, type };
}

async function main() {
  await mkdir(IMAGE_DIR, { recursive: true });
  const printings = await prisma.printing.findMany({
    where: {
      isActive: true,
      language: "en",
      set: { code: { startsWith: "sealed-" } },
      ...(FORCE ? {} : { OR: [{ imagePath: null }, { imagePath: "" }] }),
    },
    select: {
      id: true,
      cardId: true,
      externalId: true,
      localizedName: true,
      imagePath: true,
      set: { select: { code: true, name: true } },
    },
    orderBy: { collectorNumber: "asc" },
  });

  console.log(`Produits scellés à traiter : ${printings.length}`);
  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const printing of printings) {
    if (!isSealedSetCode(printing.set.code)) continue;
    const name = printing.localizedName?.trim() || printing.set.name;
    const existingPath = printing.imagePath ? path.join(ROOT, "public", printing.imagePath.replace(/^\//, "")) : null;
    if (!FORCE && existingPath && (await fileExists(existingPath))) {
      skipped += 1;
      continue;
    }
    try {
      const candidates = await resolveBestImage(name);
      if (candidates.length === 0) throw new Error("aucune image pertinente");
      let saved = false;
      let lastError: unknown;
      for (const best of candidates) {
        try {
          const downloaded = await downloadImage(best.row.image);
          const filename = `${printing.id}.${downloaded.ext}`;
          const dest = path.join(IMAGE_DIR, filename);
          const publicPath = `/card-images/${filename}`;
          await writeFile(dest, downloaded.bytes);
          // Le visuel est partagé par toutes les langues du produit.
          await prisma.printing.updateMany({
            where: { cardId: printing.cardId },
            data: {
              imagePath: publicPath,
              sourceImageUrl: best.row.image,
            },
          });
          ok += 1;
          console.log(`OK  ${name} [${best.row.source} score ${best.score}]`);
          saved = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!saved) throw lastError instanceof Error ? lastError : new Error("téléchargement impossible");
    } catch (error) {
      failed += 1;
      console.warn(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(1600);
  }

  console.log(JSON.stringify({ total: printings.length, ok, failed, skipped }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
