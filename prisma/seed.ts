import { PrismaClient } from "@prisma/client";
import { CONDITIONS, PRICE_SOURCES } from "../src/lib/reference-data";

const prisma = new PrismaClient();

async function main() {
  for (const condition of CONDITIONS) {
    await prisma.condition.upsert({
      where: { code: condition.code },
      update: { name: condition.name, sortOrder: condition.sortOrder, isActive: true },
      create: { ...condition, isActive: true },
    });
  }
  for (const source of PRICE_SOURCES) {
    await prisma.priceSource.upsert({
      where: { code: source.code },
      update: { name: source.name },
      create: source,
    });
  }
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
