import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api.netdeck.gg/api/cards/cyberpunk";
const ROOT = process.cwd();
const IMAGE_DIR = path.join(ROOT, "public", "card-images");

type ApiSet = { code: string; name: string };
type ApiPrinting = {
  id: string;
  collector_number: string;
  image_url?: string | null;
  source_image_url?: string | null;
  set?: ApiSet | null;
  rarity?: string | null;
  finish?: string | null;
  artist?: string | null;
  language?: string | null;
  localized_name?: string | null;
  printed_rules_text?: string | null;
  official_rules_text?: string | null;
};
type ApiCard = {
  id: string;
  external_id: string;
  name: string;
  subname?: string | null;
  display_name?: string | null;
  slug: string;
  canonical_name?: string | null;
  canonical_base_name?: string | null;
  rules_text?: string | null;
  official_rules_text?: string | null;
  official_rules_text_en?: string | null;
  flavor_text?: string | null;
  language?: string | null;
  color?: string | null;
  card_type?: string | null;
  is_eddiable?: boolean | null;
  classifications?: string[] | null;
  keywords?: string[] | null;
  cost?: number | null;
  power?: number | null;
  ram?: number | null;
  legality?: string | null;
  rulings?: unknown[] | null;
  printings?: ApiPrinting[] | null;
  printing_id?: string;
  print_number?: string | null;
  set?: ApiSet | null;
  rarity?: string | null;
  image_url?: string | null;
  source_image_url?: string | null;
  artist?: string | null;
};
type FilterOption = string | { code?: string; name?: string; value?: string; label?: string };
type ApiFilters = {
  filters: { key: string; options: FilterOption[] }[];
};

const downloads: { url: string; dest: string; printingId: string; publicPath: string }[] = [];

async function fetchJson<T>(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "cybertpunktcg-import/0.1",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

function cleanList(values: string[] | null | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

async function fileExists(file: string) {
  try {
    const info = await stat(file);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function deactivateMissing(model: "card" | "printing", seen: Set<string>) {
  const rows =
    model === "card"
      ? await prisma.card.findMany({ select: { id: true, externalId: true } })
      : await prisma.printing.findMany({ select: { id: true, externalId: true } });
  const stale = rows.filter((row) => !seen.has(row.externalId)).map((row) => row.id);
  for (let index = 0; index < stale.length; index += 400) {
    const chunk = stale.slice(index, index + 400);
    if (chunk.length === 0) continue;
    if (model === "card") {
      await prisma.card.updateMany({ where: { id: { in: chunk } }, data: { isActive: false } });
    } else {
      await prisma.printing.updateMany({ where: { id: { in: chunk } }, data: { isActive: false } });
    }
  }
}

async function main() {
  await mkdir(IMAGE_DIR, { recursive: true });
  const filters = await fetchJson<ApiFilters>(`${API}/filters`);
  const setFilter = filters.filters.find((filter) => filter.key === "set");
  const setOrder = new Map<string, { name: string; sortOrder: number }>();
  (setFilter?.options ?? []).forEach((option, index) => {
    if (typeof option === "string" || !option.code) return;
    setOrder.set(option.code, { name: option.name || option.code, sortOrder: index });
  });

  const cards: ApiCard[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const page = await fetchJson<{ items: ApiCard[]; total: number }>(
      `${API}?limit=60&offset=${offset}`,
    );
    total = page.total;
    if (page.items.length === 0) break;
    cards.push(...page.items);
    offset += page.items.length;
    console.log(`Cartes reçues : ${cards.length} / ${total}`);
  }
  if (cards.length !== total) {
    throw new Error(`Import incomplet : ${cards.length} cartes reçues, ${total} annoncées.`);
  }

  const seenCards = new Set<string>();
  const seenPrintings = new Set<string>();

  for (const card of cards) {
    const cardRow = await prisma.card.upsert({
      where: { externalId: card.id },
      create: {
        externalId: card.id,
        code: card.external_id,
        slug: card.slug,
        name: card.name,
        subname: card.subname ?? null,
        displayName: card.display_name || card.canonical_name || card.name,
        canonicalName: card.canonical_name || card.display_name || card.name,
        canonicalBaseName: card.canonical_base_name ?? null,
        rulesText: card.official_rules_text_en || card.rules_text || card.official_rules_text || null,
        officialRulesText: card.official_rules_text ?? null,
        flavorText: card.flavor_text ?? null,
        language: card.language || "en",
        color: card.color ?? null,
        cardType: card.card_type ?? null,
        isEddiable: card.is_eddiable ?? null,
        cost: card.cost ?? null,
        power: card.power ?? null,
        ram: card.ram ?? null,
        legality: card.legality ?? null,
        rulingsJson: card.rulings && card.rulings.length > 0 ? JSON.stringify(card.rulings) : null,
        isActive: true,
      },
      update: {
        code: card.external_id,
        slug: card.slug,
        name: card.name,
        subname: card.subname ?? null,
        displayName: card.display_name || card.canonical_name || card.name,
        canonicalName: card.canonical_name || card.display_name || card.name,
        canonicalBaseName: card.canonical_base_name ?? null,
        rulesText: card.official_rules_text_en || card.rules_text || card.official_rules_text || null,
        officialRulesText: card.official_rules_text ?? null,
        flavorText: card.flavor_text ?? null,
        language: card.language || "en",
        color: card.color ?? null,
        cardType: card.card_type ?? null,
        isEddiable: card.is_eddiable ?? null,
        cost: card.cost ?? null,
        power: card.power ?? null,
        ram: card.ram ?? null,
        legality: card.legality ?? null,
        rulingsJson: card.rulings && card.rulings.length > 0 ? JSON.stringify(card.rulings) : null,
        isActive: true,
      },
    });
    seenCards.add(card.id);

    const tags = cleanList(card.classifications);
    const keywords = cleanList(card.keywords);
    await prisma.cardTag.deleteMany({ where: { cardId: cardRow.id } });
    await prisma.cardKeyword.deleteMany({ where: { cardId: cardRow.id } });
    if (tags.length > 0) {
      await prisma.cardTag.createMany({ data: tags.map((tag) => ({ cardId: cardRow.id, tag })) });
    }
    if (keywords.length > 0) {
      await prisma.cardKeyword.createMany({
        data: keywords.map((keyword) => ({ cardId: cardRow.id, keyword })),
      });
    }

    const printings = card.printings?.length
      ? card.printings
      : card.printing_id && card.set
        ? [
            {
              id: card.printing_id,
              collector_number: card.print_number || "",
              image_url: card.image_url,
              source_image_url: card.source_image_url,
              set: card.set,
              rarity: card.rarity,
              artist: card.artist,
              language: card.language,
            },
          ]
        : [];

    for (const printing of printings) {
      if (!printing.set?.code || !printing.collector_number) continue;
      const known = setOrder.get(printing.set.code);
      const setRow = await prisma.set.upsert({
        where: { code: printing.set.code },
        create: {
          code: printing.set.code,
          name: known?.name || printing.set.name,
          sortOrder: known?.sortOrder ?? 500,
          status: "available",
        },
        update: {
          name: known?.name || printing.set.name,
          sortOrder: known?.sortOrder ?? 500,
          status: "available",
        },
      });
      const filename = `${printing.id}.webp`;
      const dest = path.join(IMAGE_DIR, filename);
      const publicPath = `/card-images/${filename}`;
      const already = await fileExists(dest);
      const row = await prisma.printing.upsert({
        where: { externalId: printing.id },
        create: {
          externalId: printing.id,
          cardId: cardRow.id,
          setId: setRow.id,
          collectorNumber: printing.collector_number,
          rarity: printing.rarity ?? null,
          imagePath: already ? publicPath : null,
          sourceImageUrl: printing.source_image_url ?? null,
          artist: printing.artist ?? null,
          language: printing.language || "en",
          localizedName: printing.localized_name ?? null,
          printedRulesText: printing.printed_rules_text ?? null,
          officialRulesText: printing.official_rules_text ?? null,
          officialFinish: printing.finish ?? null,
          isActive: true,
        },
        update: {
          cardId: cardRow.id,
          setId: setRow.id,
          collectorNumber: printing.collector_number,
          rarity: printing.rarity ?? null,
          imagePath: already ? publicPath : undefined,
          sourceImageUrl: printing.source_image_url ?? null,
          artist: printing.artist ?? null,
          language: printing.language || "en",
          localizedName: printing.localized_name ?? null,
          printedRulesText: printing.printed_rules_text ?? null,
          officialRulesText: printing.official_rules_text ?? null,
          officialFinish: printing.finish ?? null,
          isActive: true,
        },
      });
      seenPrintings.add(printing.id);
      if (!already && printing.image_url) {
        downloads.push({
          url: printing.image_url,
          dest,
          printingId: row.id,
          publicPath,
        });
      }
    }
  }

  for (const [code, info] of setOrder) {
    await prisma.set.upsert({
      where: { code },
      create: { code, name: info.name, sortOrder: info.sortOrder, status: "available" },
      update: { name: info.name, sortOrder: info.sortOrder },
    });
  }

  await deactivateMissing("card", seenCards);
  await deactivateMissing("printing", seenPrintings);

  const activePrintings = await prisma.printing.findMany({
    where: { isActive: true },
    select: { setId: true },
  });
  const counts = new Map<string, number>();
  for (const printing of activePrintings) {
    counts.set(printing.setId, (counts.get(printing.setId) ?? 0) + 1);
  }
  await prisma.set.updateMany({ data: { cardCount: 0 } });
  for (const [setId, cardCount] of counts) {
    await prisma.set.update({ where: { id: setId }, data: { cardCount } });
  }

  let imagesOk = 0;
  let imagesFailed = 0;
  await mapPool(downloads, 6, async (job) => {
    try {
      const response = await fetch(job.url, { signal: AbortSignal.timeout(30000) });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("image")) {
        throw new Error(`${response.status} ${type}`);
      }
      await writeFile(job.dest, Buffer.from(await response.arrayBuffer()));
      await prisma.printing.update({
        where: { id: job.printingId },
        data: { imagePath: job.publicPath },
      });
      imagesOk += 1;
      if (imagesOk % 50 === 0) console.log(`Images : ${imagesOk}`);
    } catch (error) {
      imagesFailed += 1;
      console.warn(`Image ignorée ${job.publicPath}: ${error instanceof Error ? error.message : error}`);
    }
  });

  const [setCount, cardCount, printingTotal, priceCount] = await Promise.all([
    prisma.set.count(),
    prisma.card.count({ where: { isActive: true } }),
    prisma.printing.count({ where: { isActive: true } }),
    prisma.price.count(),
  ]);
  console.log(
    JSON.stringify(
      {
        sets: setCount,
        cards: cardCount,
        printings: printingTotal,
        printingRows: seenPrintings.size,
        imagesOk,
        imagesFailed,
        prices: priceCount,
      },
      null,
      2,
    ),
  );
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
