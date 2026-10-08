/**
 * Catalogue minimal pour la CI (base SQLite vide) : quelques cartes dans les extensions
 * utilisées par les tests. Le vrai catalogue (import:cards) n'est pas disponible en CI ;
 * les tests qui en dépendent sont alors ignorés.
 *
 *   DATABASE_URL=file:./ci.db node scripts/prisma.mjs db push && npm run db:seed && npm run test:ci:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SETS = [
  { code: "welcometonightcitybeta", name: "Welcome to Night City — Beta", language: "en", prefix: "β", sortOrder: 1 },
  { code: "welcometonightcityretail", name: "Welcome to Night City — Retail", language: "en", prefix: "", sortOrder: 2 },
  { code: "welcometonightcityretail-fr", name: "Welcome to Night City — Retail — FR", language: "fr", prefix: "", sortOrder: 3 },
];
const CARDS = ["V — Streetkid", "Royce — Psycho", "Judy Álvarez — Nothing to Doubt", "Take Control"];

async function main() {
  if (!(process.env.DATABASE_URL ?? "").startsWith("file:")) {
    throw new Error("seed-ci : DATABASE_URL doit pointer vers une base SQLite (file:...)");
  }
  // Ne jamais mélanger ces cartes factices avec un catalogue existant.
  if ((await prisma.card.count()) > 0) throw new Error("seed-ci : la base contient déjà des cartes, abandon.");

  const cards = [];
  for (const [index, name] of CARDS.entries()) {
    const id = `ci-card-${index + 1}`;
    cards.push(
      await prisma.card.create({
        data: { externalId: id, code: id, slug: id, name, displayName: name, canonicalName: name, color: "Red", cardType: "Unit", cost: 1 },
      }),
    );
  }
  for (const set of SETS) {
    const created = await prisma.set.create({
      data: { code: set.code, name: set.name, cardCount: cards.length, status: "released", sortOrder: set.sortOrder },
    });
    for (const [index, card] of cards.entries()) {
      const number = String(index + 1).padStart(3, "0");
      await prisma.printing.create({
        data: {
          externalId: `ci-${set.code}-${number}`,
          cardId: card.id,
          setId: created.id,
          collectorNumber: `${set.prefix}${number}`,
          rarity: "Common",
          language: set.language,
        },
      });
    }
  }
  console.log(`seed-ci : ${cards.length} cartes, ${cards.length * SETS.length} impressions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
