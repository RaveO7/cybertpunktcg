import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Production : le site passe par le pooler de Prisma Postgres (DATABASE_URL_POOLED), qui partage quelques
// connexions entre toutes les instances ; la connexion directe (DATABASE_URL, 10 places sur le plan gratuit)
// reste réservée au `db push` du build. Sans cette variable (local SQLite, tests), DATABASE_URL est utilisée.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_POOLED });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
