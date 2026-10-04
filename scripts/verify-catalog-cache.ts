/**
 * Vérifie le cache du catalogue sur un vrai serveur Next (unstable_cache ne marche
 * qu'à l'intérieur de Next). Lance `next start` sur une COPIE de data/collection.db.
 *
 *   npx tsx scripts/verify-catalog-cache.ts          (utilise le build existant)
 *   npx tsx scripts/verify-catalog-cache.ts --build  (rebuild avant)
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(__dirname, "..");
const sourceDb = path.join(root, "data", "collection.db");
if (!existsSync(sourceDb)) throw new Error(`base introuvable: ${sourceDb}`);
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "cptcg-catalog-"));
const dbFile = path.join(tmpDir, "test.db");
copyFileSync(sourceDb, dbFile);
const databaseUrl = `file:${dbFile.replace(/\\/g, "/")}`;
const env = { ...process.env, DATABASE_URL: databaseUrl, APP_URL: "", NODE_ENV: "production" as const };
const port = 3300 + Math.floor(Math.random() * 600);
const base = `http://127.0.0.1:${port}`;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", shell: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} a échoué:\n${result.stdout}\n${result.stderr}`);
}

let server: ChildProcess | null = null;
function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"]);
  else server.kill("SIGTERM");
  server = null;
}

let step = 0;
function ok(label: string) {
  step += 1;
  console.log(`  ✓ ${step}. ${label}`);
}

type Catalog = { printings: { id: string; setCode: string; marketPrice: string | null }[]; hasPrices: boolean };

async function main() {
  run("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"]);
  if (process.argv.includes("--build") || !existsSync(path.join(root, ".next", "BUILD_ID"))) {
    run("npx", ["next", "build"]);
  }
  // Le cache Next persiste sur disque entre deux lancements : on repart de zéro.
  rmSync(path.join(root, ".next", "cache", "fetch-cache"), { recursive: true, force: true });

  let output = "";
  server = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, env, shell: true });
  server.stdout?.on("data", (chunk) => (output += chunk));
  server.stderr?.on("data", (chunk) => (output += chunk));
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const response = await fetch(`${base}/api/auth/session`);
      if (response.status < 500) break;
    } catch {
      // serveur pas encore prêt
    }
    if (Date.now() > deadline) throw new Error(`le serveur ne démarre pas:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  console.log("verify-catalog-cache");

  const getCatalog = async () => {
    const response = await fetch(`${base}/api/catalog`);
    assert.equal(response.status, 200, "le catalogue doit se charger");
    return { response, body: (await response.json()) as Catalog };
  };

  // 1. Réponse publique, mise en cache par le CDN.
  const first = await getCatalog();
  const cacheControl = first.response.headers.get("cache-control") ?? "";
  assert.match(cacheControl, /\bpublic\b/, `Cache-Control doit être public: "${cacheControl}"`);
  const sMaxAge = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1] ?? 0);
  assert.ok(sMaxAge > 0 && sMaxAge <= 3600, `s-maxage doit être entre 1 s et 1 h: "${cacheControl}"`);
  assert.doesNotMatch(cacheControl, /no-store|private/, "le catalogue ne doit pas être marqué privé");
  assert.ok(first.body.printings.length >= 600, "catalogue incomplet");
  assert.equal(first.body.hasPrices, true);
  ok("en-tête Cache-Control public avec s-maxage");

  // Session pour /api/stats, lu une première fois AVANT toute modification de la base.
  assert.equal((await fetch(`${base}/api/stats`)).status, 401, "les stats doivent exiger une session");
  const email = `catalog.${Date.now().toString(36)}@example.com`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password: "motdepasse-robuste", displayName: "Cache" }),
  });
  assert.ok(registered.ok, `inscription impossible: ${registered.status} ${await registered.text()}`);
  const cookie = registered.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  const getStats = async () => {
    const response = await fetch(`${base}/api/stats?scope=en`, { headers: { cookie } });
    assert.equal(response.status, 200, "les stats doivent se charger");
    return (await response.json()) as { progress: unknown; rarities: unknown; hasPrices: boolean };
  };
  const statsBefore = await getStats();
  assert.equal(statsBefore.hasPrices, true);
  assert.ok((statsBefore.progress as { total: number }).total > 0, "la checklist ne doit pas être vide au départ");

  // 2. Modification de la base : un prix change et TOUTES les cartes sont désactivées.
  // Un catalogue relu en base serait vide (et les stats tomberaient à 0 carte).
  const priced = first.body.printings.find((printing) => printing.marketPrice != null);
  assert.ok(priced, "aucune carte cotée dans la copie de la base");
  await db.price.updateMany({ where: { printingId: priced.id, kind: "trend" }, data: { amount: 9999.99 } });
  await db.printing.updateMany({ data: { isActive: false } });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const again = await getCatalog();
    assert.deepEqual(again.body, first.body, "le catalogue a été relu en base au lieu du cache");
  }
  ok("catalogue servi depuis le cache après modification de la base");

  // 3. /api/stats s'appuie sur le même cache : la progression ne bouge pas.
  const statsAfter = await getStats();
  assert.deepEqual(statsAfter.progress, statsBefore.progress, "les stats relisent le catalogue en base");
  assert.deepEqual(statsAfter.rarities, statsBefore.rarities, "les stats relisent le catalogue en base");
  ok("stats : session requise, catalogue en cache");

  await db.$disconnect();
  console.log(JSON.stringify({ ok: true, checks: step }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    stopServer();
    rmSync(path.join(root, ".next", "cache", "fetch-cache"), { recursive: true, force: true });
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows peut garder le fichier verrouillé quelques instants.
    }
  });
