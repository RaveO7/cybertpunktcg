/**
 * Introduit volontairement des bugs dans les caches (courbe de portefeuille, catalogue)
 * et vérifie que les tests les détectent. Les fichiers sont toujours restaurés.
 *
 *   npx tsx scripts/mutate-cache-checks.ts            (historique + catalogue, ~5 min)
 *   npx tsx scripts/mutate-cache-checks.ts history    (historique seulement, rapide)
 *   npx tsx scripts/mutate-cache-checks.ts catalog    (catalogue seulement, rebuild à chaque bug)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

type Group = "history" | "catalog";
type Mutation = { group: Group; name: string; file: string; from: string; to: string };

const HISTORY = "src/lib/investment-history.ts";
const BUILDER = "src/lib/price-history.ts";

const mutations: Mutation[] = [
  {
    group: "history",
    name: "le cache fige aussi hier et aujourd'hui",
    file: HISTORY,
    from: "const SETTLE_DELAY_DAYS = 2;",
    to: "const SETTLE_DELAY_DAYS = 0;",
  },
  {
    group: "history",
    name: "l'empreinte ignore les quantités",
    file: HISTORY,
    from: "hash.update(`|${printingId}:${quantity}`);",
    to: "hash.update(`|${printingId}`);",
  },
  {
    group: "history",
    name: "le cache est réutilisé même si la collection a changé",
    file: HISTORY,
    from: "const usable = cache?.fingerprint === fingerprint ? cache : null;",
    to: "const usable = cache ?? null;",
  },
  {
    group: "history",
    name: "tous les filtres partagent le même cache",
    file: HISTORY,
    from: 'const scope = `${input.setCode ?? "*"}|${input.language ?? "*"}`;',
    to: 'const scope = "*|*";',
  },
  {
    group: "history",
    name: "le cache n'est jamais lu",
    file: HISTORY,
    from: "const usable = cache?.fingerprint === fingerprint ? cache : null;",
    to: "const usable = cache?.fingerprint === fingerprint ? null : null;",
  },
  {
    group: "history",
    name: "le cache n'est jamais enregistré",
    file: HISTORY,
    from: "if (!usable || settledRows.length > 0) {",
    to: "if (usable && !usable) {",
  },
  {
    group: "history",
    name: "le cache est réécrit à chaque appel",
    file: HISTORY,
    from: "if (!usable || settledRows.length > 0) {",
    to: "if (true) {",
  },
  {
    group: "history",
    name: "le dernier jour figé est relu (gte au lieu de gt)",
    file: HISTORY,
    from: "day: { gt: utcDay(afterDay) }",
    to: "day: { gte: utcDay(afterDay) }",
  },
  {
    group: "history",
    name: "le dernier jour figé n'avance pas",
    file: HISTORY,
    from: "(max, row) => (max == null || row.day > max ? row.day : max),",
    to: "(max) => max,",
  },
  {
    group: "history",
    name: "les derniers prix figés ne sont pas sauvegardés",
    file: HISTORY,
    from: "lastPricesJson: JSON.stringify(Object.fromEntries(settled.lastPrice)),",
    to: 'lastPricesJson: "{}",',
  },
  {
    group: "history",
    name: "les jours récents repartent sans les prix figés",
    file: HISTORY,
    from: "extendPortfolioHistory(ownedList, settled.lastPrice, recentRows);",
    to: "extendPortfolioHistory(ownedList, new Map(), recentRows);",
  },
  {
    group: "history",
    name: "les points figés sont comptés deux fois",
    file: HISTORY,
    from: "const points = [...settledPoints, ...recent.points];",
    to: "const points = [...cachedPoints, ...settledPoints, ...recent.points];",
  },
  {
    group: "history",
    name: "le complément « prix précédent » a disparu",
    file: HISTORY,
    from: "if (cachedPoints.length + dayKeys.size <= 1) {",
    to: "if (cachedPoints.length + dayKeys.size < 0) {",
  },
  {
    group: "history",
    name: "un historique d'un jour est mis en cache",
    file: HISTORY,
    from: "if (cachedPoints.length + dayKeys.size <= 1) {",
    to: "if (cachedPoints.length + dayKeys.size <= 1 && dayKeys.size > 99) {",
  },
  {
    group: "history",
    name: "la reprise ignore les prix de départ",
    file: BUILDER,
    from: "const lastPrice = new Map(startPrices);",
    to: "const lastPrice = new Map<string, number>();",
  },
  {
    group: "history",
    name: "la reprise modifie l'état reçu",
    file: BUILDER,
    from: "const lastPrice = new Map(startPrices);",
    to: "const lastPrice = startPrices as Map<string, number>;",
  },
  {
    group: "history",
    name: "un prix à 0 est compté",
    file: BUILDER,
    from: "if (!Number.isFinite(snapshot.amount) || snapshot.amount <= 0) continue;\n    const list = byDay.get(snapshot.day) ?? [];\n    list.push({ printingId: snapshot.printingId, amount: snapshot.amount });\n    byDay.set(snapshot.day, list);\n  }\n  const days = [...byDay.keys()].sort();\n\n  const points",
    to: "if (!Number.isFinite(snapshot.amount) || snapshot.amount < 0) continue;\n    const list = byDay.get(snapshot.day) ?? [];\n    list.push({ printingId: snapshot.printingId, amount: snapshot.amount });\n    byDay.set(snapshot.day, list);\n  }\n  const days = [...byDay.keys()].sort();\n\n  const points",
  },
  {
    group: "history",
    name: "la suppression du compte laisse ses caches",
    file: "prisma/schema.prisma",
    from: "  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@id([userId, scope])",
    to: "  user            User     @relation(fields: [userId], references: [id], onDelete: NoAction)\n\n  @@id([userId, scope])",
  },
  {
    group: "history",
    name: "la route historique ne demande plus de session",
    file: "src/app/api/investment/history/route.ts",
    from: 'if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });',
    to: 'if (!user) return NextResponse.json({ kind: "portfolio", points: [], days: 0 });',
  },
  {
    group: "history",
    name: "la route historique ignore le filtre de set",
    file: "src/app/api/investment/history/route.ts",
    from: 'setCode: setCode && setCode !== "all" ? setCode : undefined,',
    to: "setCode: undefined,",
  },
  {
    group: "history",
    name: "pas de repli quand le cache échoue",
    file: HISTORY,
    from: "  } catch (error) {\n    // Le cache n'est qu'une optimisation",
    to: "  } catch (error) {\n    throw error;\n    // Le cache n'est qu'une optimisation",
  },
  {
    group: "history",
    name: "le repli oublie le complément « prix précédent »",
    file: HISTORY,
    from: "if (new Set(allRows.map((row) => row.day)).size <= 1) {",
    to: "if (new Set(allRows.map((row) => row.day)).size < 0) {",
  },
  {
    group: "catalog",
    name: "le catalogue n'utilise plus le cache",
    file: "src/app/api/catalog/route.ts",
    from: "const catalog = await loadCatalogCached();",
    to: 'const catalog = await (await import("@/lib/catalog")).loadCatalog();',
  },
  {
    group: "catalog",
    name: "les stats n'utilisent plus le cache du catalogue",
    file: "src/app/api/stats/route.ts",
    from: "Promise.all([loadCatalogCached(), ",
    to: 'Promise.all([(await import("@/lib/catalog")).loadCatalog(), ',
  },
  {
    group: "catalog",
    name: "le catalogue n'est plus mis en cache par le CDN",
    file: "src/app/api/catalog/route.ts",
    from: 'headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },',
    to: "headers: {},",
  },
  {
    group: "catalog",
    name: "le catalogue est marqué privé",
    file: "src/app/api/catalog/route.ts",
    from: '"public, s-maxage=300, stale-while-revalidate=3600"',
    to: '"private, max-age=300"',
  },
];

const tests: Record<Group, string> = {
  history: "npx vitest run tests/unit/logic.test.ts tests/db/history-cache.test.ts",
  catalog: "npx tsx scripts/verify-catalog-cache.ts --build",
};

const requested = process.argv[2] as Group | undefined;
const groups: Group[] = requested ? [requested] : ["history", "catalog"];
if (requested && !(requested in tests)) {
  console.error(`groupe inconnu: ${requested} (history | catalog)`);
  process.exit(1);
}
const selected = mutations.filter((mutation) => groups.includes(mutation.group));

const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const write = (file: string, contents: string) => writeFileSync(path.join(root, file), contents);
const runTests = (group: Group) => spawnSync(tests[group], { cwd: root, encoding: "utf8", shell: true });

const originals = new Map<string, string>();
for (const mutation of selected) {
  if (!originals.has(mutation.file)) originals.set(mutation.file, read(mutation.file));
  const source = originals.get(mutation.file) ?? "";
  if (!source.includes(mutation.from)) {
    console.error(`extrait introuvable pour: ${mutation.name}`);
    process.exit(1);
  }
  if (source.split(mutation.from).length !== 2) {
    console.error(`extrait ambigu (plusieurs occurrences) pour: ${mutation.name}`);
    process.exit(1);
  }
}

function restore() {
  for (const [file, contents] of originals) write(file, contents);
}

const survived: string[] = [];
try {
  for (const group of groups) {
    const baseline = runTests(group);
    if (baseline.status !== 0) {
      console.error(`${baseline.stdout}\n${baseline.stderr}`);
      console.error(`Les tests « ${group} » échouent déjà sans bug introduit.`);
      process.exit(1);
    }
    console.log(`Référence « ${group} » : les tests passent.`);

    for (const mutation of selected.filter((item) => item.group === group)) {
      const source = originals.get(mutation.file) ?? "";
      write(mutation.file, source.replace(mutation.from, mutation.to));
      const result = runTests(group);
      restore();
      if (result.status === 0) {
        survived.push(mutation.name);
        console.log(`MANQUÉ: ${mutation.name}`);
      } else {
        const detail = `${result.stderr}\n${result.stdout}`
          .split("\n")
          .map((line) => line.trim())
          .find((line) => /assert|Error|message|doit|attendu/i.test(line));
        console.log(`DÉTECTÉ: ${mutation.name}${detail ? ` — ${detail.slice(0, 140)}` : ""}`);
      }
    }
  }
} finally {
  restore();
  // Le dernier build a pu être fait avec un fichier modifié : on reconstruit la version saine.
  if (groups.includes("catalog")) {
    const rebuild = spawnSync("npx next build", { cwd: root, encoding: "utf8", shell: true });
    if (rebuild.status !== 0) console.error("Attention : le rebuild final a échoué, relancer `npm run build`.");
  }
}

for (const [file, contents] of originals) {
  if (read(file) !== contents) {
    console.error(`Le fichier n'a pas été restauré: ${file}`);
    process.exit(1);
  }
}

if (survived.length > 0) {
  console.error(`Bugs non détectés: ${survived.join(", ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, mutations: selected.length }));
