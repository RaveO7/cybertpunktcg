/**
 * Import CSV : route /api/collection/import (modes add/set, fusion des doublons,
 * conservation des notes et prix absents, lignes invalides ignorées).
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { POST as importRoute } from "../../src/app/api/collection/import/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

type ImportResponse = { created: number; updated: number; skipped: number; items?: unknown[]; error?: string };

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];

let userId: string;
let token: string;
let P1: string;
let P2: string;
let nmId: string;

function post(body: unknown, session: string | null = token) {
  const headers = new Headers({ "content-type": "application/json" });
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}`);
  return importRoute(
    new Request("http://127.0.0.1/api/collection/import", { method: "POST", headers, body: JSON.stringify(body) }),
  );
}

async function importOk(body: unknown) {
  const response = await post(body);
  const parsed = (await response.json()) as ImportResponse;
  assert.equal(response.status, 200, `import refusé : ${parsed.error}`);
  return parsed;
}

const row = (printingId: string, conditionId = nmId) =>
  prisma.collectionItem.findUnique({ where: { userId_printingId_conditionId: { userId, printingId, conditionId } } });

beforeAll(async () => {
  const printings = await prisma.printing.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  assert.equal(printings.length, 2, "catalogue de cartes indisponible");
  [P1, P2] = printings.map((printing) => printing.id);
  const nm = await prisma.condition.findUnique({ where: { code: "NM" } });
  assert.ok(nm, "état NM indisponible");
  nmId = nm.id;

  const user = await registerAccount({
    email: `import.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Import",
  });
  createdUserIds.push(user.id);
  userId = user.id;
  token = (await createSession(user.id)).token;
});

beforeEach(async () => {
  await prisma.collectionItem.deleteMany({ where: { userId } });
});

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("import CSV", () => {
  it("exige une session et un corps valide", async () => {
    assert.equal((await post({ lines: [{ printingId: P1, conditionCode: "NM", quantity: 1 }] }, null)).status, 401);
    assert.equal((await post({ lines: [] })).status, 400);
    assert.equal((await post({ lines: [{ printingId: P1, conditionCode: "NM", quantity: -1 }] })).status, 400);
    assert.equal((await post({ lines: [{ printingId: "inconnu", conditionCode: "NM", quantity: 1 }] })).status, 400);
    assert.equal(await prisma.collectionItem.count({ where: { userId } }), 0);
  });

  it("crée, fusionne les doublons et ignore les lignes invalides", async () => {
    const result = await importOk({
      lines: [
        { printingId: P1, conditionCode: "NM", quantity: 2, purchasePrice: "1,5" },
        { printingId: P1, conditionCode: "NM", quantity: 3, notes: "classeur A" },
        { printingId: P2, conditionCode: "LP", quantity: 1 },
        { printingId: "inconnu", conditionCode: "NM", quantity: 1 },
        { printingId: P2, conditionCode: "ZZ", quantity: 1 },
      ],
    });
    assert.deepEqual([result.created, result.updated, result.skipped], [2, 0, 2]);
    assert.equal(result.items?.length, 2);
    const line = await row(P1);
    assert.equal(line?.quantity, 5);
    assert.equal(line?.notes, "classeur A");
    assert.equal(line?.purchasePrice?.toString(), "1.5");
    assert.equal(line?.purchaseCurrency, "EUR");
  });

  it("« add » ajoute, « set » remplace, notes et prix absents conservés", async () => {
    await importOk({ lines: [{ printingId: P1, conditionCode: "NM", quantity: 2, notes: "gardée", purchasePrice: "3" }] });

    const added = await importOk({ mode: "add", lines: [{ printingId: P1, conditionCode: "NM", quantity: 4 }] });
    assert.deepEqual([added.created, added.updated], [0, 1]);
    assert.equal((await row(P1))?.quantity, 6);

    await importOk({ mode: "set", lines: [{ printingId: P1, conditionCode: "NM", quantity: 1 }] });
    const line = await row(P1);
    assert.equal(line?.quantity, 1);
    assert.equal(line?.notes, "gardée");
    assert.equal(line?.purchasePrice?.toString(), "3");

    await importOk({ mode: "add", lines: [{ printingId: P1, conditionCode: "NM", quantity: 999 }] });
    assert.equal((await row(P1))?.quantity, 999, "plafond par ligne");
  });
});
