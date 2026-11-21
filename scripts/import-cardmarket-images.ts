// Visuels Cardmarket des produits sans image (impressions `cardmarket:<idProduct>` : scellés et cartes absentes
// de netdeck), copiés dans public/card-images. Les autres sources (netdeck, exburst) passent avant : seules les
// impressions encore sans image sont traitées. Ce qui reste sans visuel s'affiche avec le dos de carte.
// Usage : npx tsx scripts/import-cardmarket-images.ts   (base locale ; images à commiter, puis /sync-prod)
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { sealedExternalId, sealedProductId } from "../src/lib/cardmarket-sealed";
import { requireLocalDatabase } from "./sql-dump";

requireLocalDatabase();
const prisma = new PrismaClient();
const CACHE_DIR = path.join("data", "cardmarket");
const IMAGE_DIR = path.join("public", "card-images");
const IMAGE_BASE = "https://product-images.s3.cardmarket.com";
const SINGLES_CATEGORY = 1661;
// Dossier des cartes à l'unité dans les adresses d'images Cardmarket, par extension (relevé sur le site).
const SINGLES_FOLDER_BY_EXPANSION: Readonly<Record<number, string>> = { 6722: "ALPHA" };
// Sans en-têtes de navigateur (dont le Referer), le serveur d'images répond 403.
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  referer: "https://www.cardmarket.com/",
  accept: "image/avif,image/webp,image/*,*/*;q=0.8",
};

const productFile = z.object({
  products: z.array(z.object({ idProduct: z.number(), idCategory: z.number(), idExpansion: z.number().nullable() })),
});

function readProducts(file: string) {
  return productFile.parse(JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"))).products;
}

function imageUrl(product: { idProduct: number; idCategory: number; idExpansion: number | null }) {
  const id = product.idProduct;
  if (product.idCategory !== SINGLES_CATEGORY) return `${IMAGE_BASE}/${product.idCategory}/${id}/${id}.jpg`;
  const folder = product.idExpansion == null ? undefined : SINGLES_FOLDER_BY_EXPANSION[product.idExpansion];
  return folder ? `${IMAGE_BASE}/${SINGLES_CATEGORY}/${folder}/${id}/${id}.jpg` : null;
}

// Le serveur renvoie un type de contenu générique et des PNG sous une adresse « .jpg » : format lu dans le fichier.
function imageExtension(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

async function main() {
  const products = new Map(
    [...readProducts("products_singles_23.json"), ...readProducts("products_nonsingles_23.json")].map((p) => [p.idProduct, p]),
  );
  const printings = await prisma.printing.findMany({
    where: { isActive: true, language: "en", imagePath: null, externalId: { startsWith: "cardmarket:" } },
    select: { id: true, externalId: true, localizedName: true, card: { select: { displayName: true } } },
  });
  let saved = 0;
  const missing: string[] = [];
  for (const printing of printings) {
    const idProduct = sealedProductId(printing.externalId);
    const product = idProduct == null ? undefined : products.get(idProduct);
    const url = product ? imageUrl(product) : null;
    const label = printing.localizedName ?? printing.card.displayName;
    if (!product || !url) {
      missing.push(`${label} (adresse inconnue)`);
      continue;
    }
    const response = await fetch(url, { headers: HEADERS });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = response.ok ? imageExtension(bytes) : null;
    if (!extension) {
      missing.push(`${label} (${response.status}${response.ok ? ", pas une image" : ""})`);
      continue;
    }
    const file = `${printing.id}.${extension}`;
    await writeFile(path.join(IMAGE_DIR, file), bytes);
    // Même produit dans toutes les langues (scellés) : même visuel.
    await prisma.printing.updateMany({
      where: { externalId: { in: [sealedExternalId(product.idProduct), sealedExternalId(product.idProduct, "fr")] } },
      data: { imagePath: `/card-images/${file}`, sourceImageUrl: url },
    });
    saved += 1;
    console.log(`OK  ${label}`);
  }
  console.log(JSON.stringify({ sansImage: printings.length, ajoutees: saved, introuvables: missing }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
