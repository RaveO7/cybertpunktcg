// Outils partagés pour transformer des lignes Prisma (base locale SQLite) en SQL Postgres.
import { Prisma, PrismaClient } from "@prisma/client";

export function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toString();
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function scalarColumns(model: string) {
  const found = Prisma.dmmf.datamodel.models.find((entry) => entry.name === model);
  if (!found) throw new Error(`Modèle ${model} absent du schéma`);
  return found.fields
    .filter((field) => field.kind === "scalar" || field.kind === "enum")
    .map((field) => field.name);
}

export async function readRows(prisma: PrismaClient, model: string) {
  const delegate = (prisma as unknown as Record<string, { findMany(): Promise<Record<string, unknown>[]> }>)[
    model[0].toLowerCase() + model.slice(1)
  ];
  return delegate.findMany();
}

/** INSERT par paquets de 500 lignes ; `suffix` est ajouté à chaque paquet (ex. ON CONFLICT ...). */
export function insertStatements(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  suffix = "",
) {
  const header = `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES`;
  const statements: string[] = [];
  for (let start = 0; start < rows.length; start += 500) {
    const values = rows
      .slice(start, start + 500)
      .map((row) => `(${columns.map((column) => literal(row[column])).join(", ")})`);
    statements.push(`${header}\n${values.join(",\n")}${suffix ? `\n${suffix}` : ""};`);
  }
  return statements;
}

export function requireLocalDatabase() {
  if (!process.env.DATABASE_URL && process.loadEnvFile) process.loadEnvFile(".env");
  if (!process.env.DATABASE_URL?.startsWith("file:")) {
    throw new Error("DATABASE_URL doit pointer vers la base SQLite locale (file:...).");
  }
}
