// Attribue un rôle global à un compte : seul moyen de devenir administrateur (jamais par l'API).
// Usage : npx tsx scripts/set-role.ts <email> <user|admin>
// La base visée est celle de DATABASE_URL (.env en local).
import { existsSync } from "node:fs";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

const ROLES = ["user", "admin"] as const;

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error("Usage : npx tsx scripts/set-role.ts <email> <user|admin>");
    process.exitCode = 1;
    return;
  }
  const { prisma } = await import("../src/lib/prisma");
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) {
      console.error(`Aucun compte avec l'e-mail ${email}.`);
      process.exitCode = 1;
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    console.log(`${email} : rôle « ${role} ».`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
