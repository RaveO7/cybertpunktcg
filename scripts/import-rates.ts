// Import local des taux de change de la BCE dans la base pointée par DATABASE_URL (le cron Vercel le fait
// chaque jour avant l'import des prix). La logique est dans src/lib/exchange-rates.ts.
import { PrismaClient } from "@prisma/client";
import { syncExchangeRates } from "../src/lib/exchange-rates";

const prisma = new PrismaClient();

syncExchangeRates(prisma)
  .then(async (report) => {
    console.log(JSON.stringify(report, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
