import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";

/**
 * Ces tests vérifient le vrai catalogue : l'import local (npm run import:cards) ou, en CI,
 * l'instantané tests/fixtures/catalog.json chargé par tests/fixtures/seed-ci.ts.
 */
export async function assertFullCatalog() {
  const cards = await prisma.card.count();
  assert.ok(
    cards >= 140,
    `catalogue incomplet (${cards} cartes) : lancer npm run import:cards, ou npm run test:ci:seed sur une base vide`,
  );
}
