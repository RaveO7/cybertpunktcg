import { PrismaClient } from "@prisma/client";
import { changesHomeDirectory, revalidateHome } from "@/lib/home-revalidation";

// Production : le site passe par le pooler de Prisma Postgres (DATABASE_URL_POOLED), qui partage quelques
// connexions entre toutes les instances ; la connexion directe (DATABASE_URL, 10 places sur le plan gratuit)
// reste réservée au `db push` du build. Sans cette variable (local SQLite, tests), DATABASE_URL est utilisée.
// Toute écriture dans l'annuaire de l'accueil (tournois, inscrits, boutiques) régénère l'accueil : posé
// ici une fois pour toutes, aucune fonction d'écriture ne peut l'oublier.
// Une extension de requêtes seule ne change ni les modèles ni leurs résultats : le client garde le type de
// PrismaClient attendu partout (fonctions qui reçoivent le client, transactions), au lieu du type étendu.
function createClient(): PrismaClient {
  const client = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_POOLED }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (changesHomeDirectory(model, operation)) revalidateHome();
          return result;
        },
      },
    },
  });
  return client as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
