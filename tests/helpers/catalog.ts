import { prisma } from "../../src/lib/prisma";

/** Vrai catalogue importé (import:cards) et non les quelques cartes de tests/fixtures/seed-ci.ts. */
export async function hasFullCatalog() {
  return (await prisma.card.count()) >= 140;
}
