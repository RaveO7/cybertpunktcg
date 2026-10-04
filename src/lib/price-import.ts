// Import du guide de prix Cardmarket (prix tendance + historique quotidien + produits scellés).
// Utilisé par le script local (scripts/import-prices.ts) et par le cron Vercel
// (src/app/api/cron/import-prices/route.ts).
import { gunzipSync } from "node:zlib";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  matchCardmarketPrices,
  parsePriceFile,
  parsePriceGuideDate,
  parseProductFile,
} from "./cardmarket";
import {
  parseSealedProductFile,
  sealedCategoryFor,
  SEALED_LANGUAGES,
  sealedExternalId,
  sealedProductId,
  slugifySealed,
  type SealedProduct,
} from "./cardmarket-sealed";
import { shiftUtcDay, utcDay, utcDayKey } from "./price-history";

const DOWNLOAD_BASE = "https://downloads.s3.cardmarket.com/productCatalog";
const DEFAULT_GAME_ID = 23;
const HEADERS = {
  accept: "application/json,text/plain,*/*",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  referer: "https://www.cardmarket.com/fr/Cyberpunk/Data/Price-Guide",
};

export type PriceFiles = { products: string; prices: string; nonsingles: string | null };

export type ImportPricesOptions = {
  /** Dossier où les fichiers Cardmarket sont téléchargés / lus. */
  cacheDir: string;
  /** N'utilise que les fichiers déjà présents dans cacheDir. */
  offline?: boolean;
  /** Importe même si ce guide de prix a déjà été importé. */
  force?: boolean;
  /** Fichiers précis à importer (ignore le téléchargement). */
  files?: PriceFiles;
  log?: (message: string) => void;
};

export type ImportPricesResult =
  | { status: "skipped"; message: string }
  | { status: "imported"; report: Record<string, unknown> };

type Ctx = { prisma: PrismaClient; cacheDir: string; log: (message: string) => void };

export async function importPrices(prisma: PrismaClient, options: ImportPricesOptions): Promise<ImportPricesResult> {
  const ctx: Ctx = { prisma, cacheDir: options.cacheDir, log: options.log ?? console.log };
  const files = options.files ?? (await resolveFiles(ctx, options.offline ?? false));
  let products;
  let trends;
  let sealedProducts: SealedProduct[] = [];
  let guideDate: Date | null;
  try {
    const [productText, priceText] = await Promise.all([readText(files.products), readText(files.prices)]);
    products = parseProductFile(productText);
    trends = parsePriceFile(priceText);
    guideDate = parsePriceGuideDate(priceText);
    if (files.nonsingles) {
      sealedProducts = parseSealedProductFile(await readText(files.nonsingles));
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "fichier illisible";
    throw new Error(
      `Lecture impossible (${detail}). Il faut le JSON du catalogue singles, du guide de prix, et idéalement des produits scellés/lots Cardmarket.`,
    );
  }

  const skipped = await assertNewGuide(ctx, guideDate, options.force ?? false);
  if (skipped) return { status: "skipped", message: skipped };

  const sealedUpsert =
    sealedProducts.length > 0 ? await upsertSealedProducts(ctx, sealedProducts) : { products: 0 };
  const sealedAssignments = await sealedPriceAssignments(ctx, trends);

  const [sets, printings] = await Promise.all([
    prisma.set.findMany({ select: { code: true, name: true } }),
    prisma.printing.findMany({
      where: { isActive: true, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: {
        id: true,
        collectorNumber: true,
        set: { select: { code: true } },
        card: { select: { canonicalName: true } },
      },
    }),
  ]);
  const report = matchCardmarketPrices(
    products,
    trends,
    sets,
    printings.map((printing) => ({
      id: printing.id,
      setCode: printing.set.code,
      collectorNumber: printing.collectorNumber,
      name: printing.card.canonicalName,
    })),
  );
  const assignments = [...report.assignments, ...sealedAssignments];
  if (assignments.length === 0) {
    throw new Error(
      "Aucun prix tendance n'a pu être associé. Vérifiez que les fichiers sont bien ceux de Cyberpunk.",
    );
  }

  const source = await prisma.priceSource.upsert({
    where: { code: "cardmarket" },
    update: { name: "Cardmarket" },
    create: { code: "cardmarket", name: "Cardmarket" },
  });
  const today = utcDay();
  const yesterday = shiftUtcDay(today, -1);
  const [existing, todaySnapshots] = await Promise.all([
    prisma.price.findMany({
      where: { sourceId: source.id, kind: "trend" },
      select: { printingId: true, amount: true, previousAmount: true },
    }),
    prisma.priceSnapshot.findMany({
      where: { sourceId: source.id, kind: "trend", day: today },
      select: { printingId: true, amount: true },
    }),
  ]);
  const previousByPrinting = new Map(
    existing.map((price) => [
      price.printingId,
      { amount: price.amount, previousAmount: price.previousAmount },
    ]),
  );
  const todayAmountByPrinting = new Map(
    todaySnapshots.map((row) => [row.printingId, Number(row.amount.toString())]),
  );

  const archivedBaselines: { printingId: string; amount: number }[] = [];
  for (const assignment of assignments) {
    const next = Number(assignment.amount);
    const snapAmount = todayAmountByPrinting.get(assignment.printingId);
    if (snapAmount != null && moneyChanged(snapAmount, next)) {
      archivedBaselines.push({ printingId: assignment.printingId, amount: snapAmount });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.price.deleteMany({ where: { sourceId: source.id, kind: "trend" } });
    for (let index = 0; index < assignments.length; index += 200) {
      const chunk = assignments.slice(index, index + 200);
      await tx.price.createMany({
        data: chunk.map((assignment) => {
          const next = Number(assignment.amount);
          const prior = previousByPrinting.get(assignment.printingId);
          const snapAmount = todayAmountByPrinting.get(assignment.printingId);
          const oldAmount =
            snapAmount != null && Number.isFinite(snapAmount)
              ? snapAmount
              : prior
                ? Number(prior.amount.toString())
                : null;
          let previousAmount: string | null = null;
          if (oldAmount != null && Number.isFinite(oldAmount) && moneyChanged(oldAmount, next)) {
            previousAmount = oldAmount.toFixed(2);
          } else if (prior?.previousAmount != null) {
            previousAmount = prior.previousAmount.toString();
          }
          return {
            printingId: assignment.printingId,
            sourceId: source.id,
            kind: "trend",
            amount: assignment.amount,
            previousAmount,
            currency: "EUR",
          };
        }),
      });
    }
  });

  const pricedPrintingIds = new Set(assignments.map((assignment) => assignment.printingId));
  const orphanedPrintingIds = existing
    .map((price) => price.printingId)
    .filter((printingId) => !pricedPrintingIds.has(printingId));
  if (orphanedPrintingIds.length > 0) {
    await prisma.priceSnapshot.deleteMany({
      where: {
        sourceId: source.id,
        kind: "trend",
        printingId: { in: orphanedPrintingIds },
      },
    });
    // L'historique passé a changé : les courbes de portefeuille figées sont à recalculer.
    await prisma.portfolioHistoryCache.deleteMany({});
  }

  let snapshotsWritten = 0;
  let baselinesWritten = 0;
  const baselineCandidates: { printingId: string; amount: number }[] = [...archivedBaselines];
  for (const assignment of assignments) {
    const prior = previousByPrinting.get(assignment.printingId);
    if (!prior) continue;
    const oldAmount = Number(prior.amount.toString());
    const next = Number(assignment.amount);
    if (todayAmountByPrinting.has(assignment.printingId)) continue;
    const baseline =
      Number.isFinite(oldAmount) && moneyChanged(oldAmount, next)
        ? oldAmount
        : prior.previousAmount == null
          ? null
          : Number(prior.previousAmount.toString());
    if (baseline == null || !Number.isFinite(baseline) || baseline <= 0) continue;
    baselineCandidates.push({ printingId: assignment.printingId, amount: baseline });
  }
  const existingBaselines = baselineCandidates.length
    ? await prisma.priceSnapshot.findMany({
        where: {
          sourceId: source.id,
          kind: "trend",
          day: yesterday,
          printingId: { in: baselineCandidates.map((row) => row.printingId) },
        },
        select: { printingId: true },
      })
    : [];
  const hasBaseline = new Set(existingBaselines.map((row) => row.printingId));

  for (let index = 0; index < assignments.length; index += 200) {
    const chunk = assignments.slice(index, index + 200);
    const result = await prisma.$transaction(
      chunk.map((assignment) =>
        prisma.priceSnapshot.upsert({
          where: {
            printingId_sourceId_kind_day: {
              printingId: assignment.printingId,
              sourceId: source.id,
              kind: "trend",
              day: today,
            },
          },
          update: { amount: assignment.amount, currency: "EUR" },
          create: {
            printingId: assignment.printingId,
            sourceId: source.id,
            kind: "trend",
            amount: assignment.amount,
            currency: "EUR",
            day: today,
          },
        }),
      ),
    );
    snapshotsWritten += result.length;
  }

  const baselinesToCreate = baselineCandidates.filter((row) => !hasBaseline.has(row.printingId));
  for (let index = 0; index < baselinesToCreate.length; index += 200) {
    const chunk = baselinesToCreate.slice(index, index + 200);
    const created = await prisma.priceSnapshot.createMany({
      data: chunk.map((row) => ({
        printingId: row.printingId,
        sourceId: source.id,
        kind: "trend",
        amount: row.amount,
        currency: "EUR",
        day: yesterday,
      })),
    });
    baselinesWritten += created.count;
  }

  await prisma.priceSource.update({ where: { id: source.id }, data: { guideCreatedAt: guideDate } });

  return {
    status: "imported",
    report: {
      products: files.products,
      prices: files.prices,
      guideCreatedAt: guideDate?.toISOString() ?? null,
      nonsingles: files.nonsingles,
      productsRead: report.products,
      withTrend: report.pricedProducts,
      matchedProducts: report.matchedProducts,
      sealedProducts: sealedUpsert.products,
      sealedPriced: sealedAssignments.length,
      printingsPriced: assignments.length,
      ambiguous: report.ambiguousProducts,
      unknownExpansion: report.unknownExpansionProducts,
      unknownExpansions: report.unknownExpansions,
      unmatchedSamples: report.unmatchedSamples,
      snapshotDay: utcDayKey(today),
      snapshotsWritten,
      baselinesWritten,
      expansions: report.expansions.map((entry) => ({
        expansion: entry.key,
        set: entry.setCode,
        products: entry.products,
      })),
    },
  };
}

/** Renvoie un message si le guide est déjà importé (ou plus ancien), sinon null. */
async function assertNewGuide({ prisma }: Ctx, guideDate: Date | null, force: boolean) {
  if (force) return null;
  if (!guideDate) {
    throw new Error(
      "Le guide de prix n'a pas de date (createdAt). Import annulé ; relancez avec --force pour l'importer quand même.",
    );
  }
  const source = await prisma.priceSource.findUnique({
    where: { code: "cardmarket" },
    select: { guideCreatedAt: true },
  });
  const last = source?.guideCreatedAt;
  if (last && guideDate.getTime() <= last.getTime()) {
    const same = guideDate.getTime() === last.getTime();
    return [
      same
        ? `Ce guide de prix (${guideDate.toISOString()}) a déjà été importé.`
        : `Ce guide de prix (${guideDate.toISOString()}) est plus ancien que le dernier importé (${last.toISOString()}).`,
      "Rien n'a été modifié. Relancez avec --force pour l'importer quand même.",
    ].join("\n");
  }
  return null;
}

async function upsertSealedProducts({ prisma }: Ctx, products: SealedProduct[]) {
  const categories = new Map<string, ReturnType<typeof sealedCategoryFor>>();
  for (const product of products) {
    const category = sealedCategoryFor(product);
    categories.set(category.code, category);
  }
  for (const category of categories.values()) {
    await prisma.set.upsert({
      where: { code: category.code },
      update: { name: category.name, sortOrder: category.sortOrder, status: "available" },
      create: {
        code: category.code,
        name: category.name,
        sortOrder: category.sortOrder,
        status: "available",
        cardCount: 0,
      },
    });
  }
  const sets = await prisma.set.findMany({
    where: { code: { in: [...categories.keys()] } },
    select: { id: true, code: true },
  });
  const setIdByCode = new Map(sets.map((set) => [set.code, set.id]));
  let count = 0;
  for (const product of products) {
    const category = sealedCategoryFor(product);
    const setId = setIdByCode.get(category.code);
    if (!setId) continue;
    const externalId = sealedExternalId(product.idProduct);
    const slug = slugifySealed(product.name, product.idProduct);
    const card = await prisma.card.upsert({
      where: { externalId },
      update: {
        name: product.name,
        displayName: product.name,
        canonicalName: product.name,
        cardType: category.cardType,
        isActive: true,
      },
      create: {
        externalId,
        code: externalId,
        slug,
        name: product.name,
        displayName: product.name,
        canonicalName: product.name,
        cardType: category.cardType,
        language: "en",
      },
    });
    // Une impression par langue : même produit, même prix tendance, même visuel.
    type SealedImage = { imagePath: string | null; sourceImageUrl: string | null };
    let image: SealedImage | null = null;
    for (const language of SEALED_LANGUAGES) {
      const printingExternalId = sealedExternalId(product.idProduct, language);
      const printing: SealedImage & { id: string } = await prisma.printing.upsert({
        where: { externalId: printingExternalId },
        update: {
          cardId: card.id,
          setId,
          collectorNumber: String(product.idProduct),
          rarity: category.cardType,
          language,
          localizedName: product.name,
          isActive: true,
        },
        create: {
          externalId: printingExternalId,
          cardId: card.id,
          setId,
          collectorNumber: String(product.idProduct),
          rarity: category.cardType,
          language,
          localizedName: product.name,
          imagePath: image?.imagePath ?? null,
          sourceImageUrl: image?.sourceImageUrl ?? null,
        },
        select: { id: true, imagePath: true, sourceImageUrl: true },
      });
      if (!image && printing.imagePath) {
        image = printing;
      } else if (image && !printing.imagePath) {
        await prisma.printing.update({
          where: { id: printing.id },
          data: { imagePath: image.imagePath, sourceImageUrl: image.sourceImageUrl },
        });
      }
    }
    count += 1;
  }
  for (const category of categories.values()) {
    const setId = setIdByCode.get(category.code);
    if (!setId) continue;
    const cardCount = await prisma.printing.count({ where: { setId, isActive: true, language: "en" } });
    await prisma.set.update({ where: { id: setId }, data: { cardCount } });
  }
  return { products: count };
}

async function sealedPriceAssignments({ prisma }: Ctx, trends: Map<number, number>) {
  const printings = await prisma.printing.findMany({
    where: { isActive: true, externalId: { startsWith: "cardmarket:" } },
    select: { id: true, externalId: true },
  });
  const assignments: { printingId: string; amount: string; productId: number }[] = [];
  for (const printing of printings) {
    const idProduct = sealedProductId(printing.externalId);
    if (idProduct == null) continue;
    const amount = trends.get(idProduct);
    if (amount == null) continue;
    assignments.push({ printingId: printing.id, amount: amount.toFixed(2), productId: idProduct });
  }
  return assignments;
}

async function resolveFiles(ctx: Ctx, offline: boolean): Promise<PriceFiles> {
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
  return {
    products: path.join(ctx.cacheDir, `products_singles_${id}.json`),
    prices: path.join(ctx.cacheDir, `price_guide_${id}.json`),
    nonsingles: path.join(ctx.cacheDir, `products_nonsingles_${id}.json`),
  };
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

async function readText(file: string) {
  const bytes = await readFile(file);
  const unzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return unzipped.toString("utf8");
}

function moneyChanged(left: number, right: number) {
  return Math.round(left * 100) !== Math.round(right * 100);
}

