/**
 * Cas limites des écritures de collection : validation des routes, modes add/set,
 * ajout groupé, changement d'état (fusion) et suppression.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { POST as bulkRoute } from "../../src/app/api/collection/bulk/route";
import { DELETE as deleteRoute, PATCH as patchRoute } from "../../src/app/api/collection/[id]/route";
import { GET as readRoute, POST as saveRoute } from "../../src/app/api/collection/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

type Line = {
  id: string;
  printingId: string;
  conditionCode: string;
  quantity: number;
  notes: string | null;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
};
type Mutation = { item: Line | null; deletedId: string | null };

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];

let userId: string;
let token: string;
let otherToken: string;
let P1: string;
let P2: string;
let P3: string;
let NM: string;
let LP: string;
let nmId: string;
let lpId: string;

function request(path: string, init: RequestInit = {}, session: string | null = token) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}`);
  return new Request(`http://127.0.0.1${path}`, { ...init, headers });
}

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`réponse non JSON ${response.status}: ${text.slice(0, 200)}`);
  }
}

function save(body: unknown, session: string | null = token) {
  return saveRoute(
    request("/api/collection", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }, session),
  );
}

async function saveOk(body: unknown) {
  const response = await save(body);
  const parsed = await json<Mutation & { error?: string }>(response);
  assert.equal(response.status, 200, `enregistrement refusé : ${parsed.error}`);
  return parsed;
}

function patch(id: string, body: unknown, session: string | null = token) {
  return patchRoute(request(`/api/collection/${id}`, { method: "PATCH", body: JSON.stringify(body) }, session), {
    params: Promise.resolve({ id }),
  });
}

function remove(id: string, session: string | null = token) {
  return deleteRoute(request(`/api/collection/${id}`, { method: "DELETE" }, session), {
    params: Promise.resolve({ id }),
  });
}

function bulk(body: unknown, session: string | null = token) {
  return bulkRoute(request("/api/collection/bulk", { method: "POST", body: JSON.stringify(body) }, session));
}

const rows = () => prisma.collectionItem.findMany({ where: { userId }, orderBy: { addedAt: "asc" } });
const row = (printingId: string, conditionId = nmId) =>
  prisma.collectionItem.findUnique({ where: { userId_printingId_conditionId: { userId, printingId, conditionId } } });

async function expectRejected(body: unknown, message?: RegExp) {
  const before = await rows();
  const response = await save(body);
  const parsed = await json<{ error?: string }>(response);
  assert.equal(response.status, 400, `devrait être refusé : ${JSON.stringify(body).slice(0, 80)}`);
  assert.ok(parsed.error, "un message d'erreur est renvoyé");
  if (message) assert.match(parsed.error, message);
  assert.deepEqual(await rows(), before, "une requête refusée ne modifie rien");
}

beforeAll(async () => {
  const printings = await prisma.printing.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 3,
  });
  assert.equal(printings.length, 3, "catalogue de cartes indisponible");
  [P1, P2, P3] = printings.map((printing) => printing.id);
  const conditions = await prisma.condition.findMany({ orderBy: { sortOrder: "asc" }, take: 2 });
  assert.equal(conditions.length, 2, "états de cartes indisponibles");
  [NM, LP] = conditions.map((condition) => condition.code);
  [nmId, lpId] = conditions.map((condition) => condition.id);
  assert.equal(NM, "NM", "l'état par défaut des routes est NM");

  const user = await registerAccount({
    email: `collection.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Collection",
  });
  createdUserIds.push(user.id);
  userId = user.id;
  token = (await createSession(user.id)).token;
  const other = await registerAccount({
    email: `collection.autre.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Autre",
  });
  createdUserIds.push(other.id);
  otherToken = (await createSession(other.id)).token;
});

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("écritures sans session", () => {
  it("POST, PATCH, DELETE et ajout groupé exigent une session", async () => {
    assert.equal((await save({ printingId: P1, quantity: 1 }, null)).status, 401);
    assert.equal((await patch("x", { quantity: 1 }, null)).status, 401);
    assert.equal((await remove("x", null)).status, 401);
    assert.equal((await bulk({ lines: [{ printingId: P1, quantity: 1 }] }, null)).status, 401);
    assert.equal((await readRoute(request("/api/collection", {}, null))).status, 401);
    assert.equal(await prisma.collectionItem.count({ where: { userId } }), 0);
  });
});

describe.sequential("validation de POST /api/collection", () => {
  beforeEach(async () => {
    await prisma.collectionItem.deleteMany({ where: { userId } });
  });

  it("refuse les quantités invalides", async () => {
    for (const quantity of [-1, 2.5, 1000, 1e9, "abc", "", null, true, [1], { n: 1 }, Number.NaN]) {
      await expectRejected({ printingId: P1, conditionCode: NM, quantity, mode: "set" });
    }
    await expectRejected({ printingId: P1, conditionCode: NM, mode: "set" });
  });

  it("accepte une quantité numérique en chaîne et la borne 999", async () => {
    assert.equal((await saveOk({ printingId: P1, quantity: "3", mode: "set" })).item?.quantity, 3);
    assert.equal((await saveOk({ printingId: P1, quantity: 999, mode: "set" })).item?.quantity, 999);
  });

  it("refuse carte, état, mode et corps inconnus", async () => {
    await expectRejected({ printingId: `inconnue-${stamp}`, quantity: 1 }, /introuvable/i);
    await expectRejected({ printingId: "", quantity: 1 });
    await expectRejected({ printingId: "x".repeat(129), quantity: 1 });
    await expectRejected({ printingId: 42, quantity: 1 });
    await expectRejected({ printingId: P1, conditionCode: "ZZ", quantity: 1 }, /introuvable/i);
    await expectRejected({ printingId: P1, conditionCode: "x".repeat(17), quantity: 1 });
    await expectRejected({ printingId: P1, quantity: 1, mode: "replace" });
    await expectRejected("pas du json");
    await expectRejected([]);
    await expectRejected(null);
  });

  it("l'état par défaut est NM et le mode par défaut ajoute", async () => {
    await saveOk({ printingId: P1, quantity: 2 });
    await saveOk({ printingId: P1, quantity: 3 });
    const stored = await row(P1);
    assert.equal(stored?.quantity, 5);
  });

  it("prix : virgule décimale, nombre, effacement ; refuse texte, négatif et énorme", async () => {
    const comma = await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "12,50" });
    assert.equal(Number(comma.item?.purchasePrice), 12.5);
    assert.equal(comma.item?.purchaseCurrency, "EUR", "EUR par défaut quand un prix est donné");
    const numeric = await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: 7 });
    assert.equal(Number(numeric.item?.purchasePrice), 7);
    const zero = await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "0" });
    assert.equal(Number(zero.item?.purchasePrice), 0);

    for (const purchasePrice of ["abc", "-1", -0.01, "1000001", "1,234.56", "12.5.0", "Infinity", true, [1]]) {
      await expectRejected({ printingId: P1, quantity: 1, mode: "set", purchasePrice });
    }

    await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "5", purchaseCurrency: "USD" });
    const cleared = await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "" });
    assert.equal(cleared.item?.purchasePrice, null, "« » efface le prix");
    assert.equal(cleared.item?.purchaseCurrency, null, "la devise est effacée avec le prix");
  });

  it("devise : liste fermée, conservée sans prix", async () => {
    for (const purchaseCurrency of ["JPY", "eur", "", 1]) {
      await expectRejected({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "2", purchaseCurrency });
    }
    await saveOk({ printingId: P1, quantity: 1, mode: "set", purchasePrice: "2", purchaseCurrency: "GBP" });
    const kept = await saveOk({ printingId: P1, quantity: 4, mode: "set" });
    assert.equal(kept.item?.purchaseCurrency, "GBP", "sans prix ni devise, les valeurs existantes restent");
    assert.equal(Number(kept.item?.purchasePrice), 2);
    const usd = await saveOk({ printingId: P1, quantity: 4, mode: "set", purchaseCurrency: "USD" });
    assert.equal(usd.item?.purchaseCurrency, "USD");
    assert.equal(Number(usd.item?.purchasePrice), 2, "changer la devise garde le prix");
  });

  it("notes : tronquées à 2000 caractères, vides = null, type vérifié", async () => {
    const long = await saveOk({ printingId: P1, quantity: 1, mode: "set", notes: `  ${"é".repeat(5000)}  ` });
    assert.equal(long.item?.notes?.length, 2000);
    assert.equal((await row(P1))?.notes?.length, 2000);
    const blank = await saveOk({ printingId: P1, quantity: 1, mode: "set", notes: "   " });
    assert.equal(blank.item?.notes, null);
    await expectRejected({ printingId: P1, quantity: 1, notes: 123 });
    await expectRejected({ printingId: P1, quantity: 1, notes: { a: 1 } });
  });
});

describe.sequential("modes add et set", () => {
  beforeEach(async () => {
    await prisma.collectionItem.deleteMany({ where: { userId } });
  });

  it("add incrémente et garde notes/prix non fournis ; set remplace la quantité", async () => {
    await saveOk({ printingId: P1, quantity: 2, notes: "classeur rouge", purchasePrice: "3" });
    const added = await saveOk({ printingId: P1, quantity: 1, mode: "add" });
    assert.equal(added.item?.quantity, 3);
    assert.equal(added.item?.notes, "classeur rouge");
    assert.equal(Number(added.item?.purchasePrice), 3);
    const set = await saveOk({ printingId: P1, quantity: 1, mode: "set" });
    assert.equal(set.item?.quantity, 1);
    assert.equal(set.item?.notes, "classeur rouge", "set sans notes garde les notes");
    const notes = await saveOk({ printingId: P1, quantity: 1, mode: "add", notes: null });
    assert.equal(notes.item?.notes, null, "notes: null efface les notes");
    assert.equal((await rows()).length, 1, "toujours une seule ligne par carte et par état");
  });

  it("une même carte dans deux états fait deux lignes", async () => {
    await saveOk({ printingId: P1, conditionCode: NM, quantity: 1 });
    await saveOk({ printingId: P1, conditionCode: LP, quantity: 2 });
    assert.equal((await row(P1, nmId))?.quantity, 1);
    assert.equal((await row(P1, lpId))?.quantity, 2);
  });

  it("set 0 supprime la ligne ; set 0 sur une ligne absente ne fait rien", async () => {
    const created = await saveOk({ printingId: P1, quantity: 2, mode: "set" });
    const cleared = await saveOk({ printingId: P1, quantity: 0, mode: "set" });
    assert.deepEqual(cleared, { item: null, deletedId: created.item?.id });
    assert.equal(await row(P1), null);
    assert.deepEqual(await saveOk({ printingId: P2, quantity: 0, mode: "set" }), { item: null, deletedId: null });
    assert.equal((await rows()).length, 0);
  });

  // BUG : « ajouter 0 exemplaire » (mode add, le mode par défaut) supprime toute la ligne,
  // notes et prix d'achat compris (collection-mutate.ts, test `input.quantity <= 0` avant le mode).
  // Attendu : add 0 = aucun changement. Observé : la ligne est supprimée.
  it.fails("BUG: add 0 ne doit pas supprimer une ligne existante", async () => {
    await saveOk({ printingId: P1, quantity: 4, notes: "précieuse", purchasePrice: "20" });
    const result = await saveOk({ printingId: P1, quantity: 0, mode: "add" });
    assert.equal(result.deletedId, null, "aucune suppression attendue");
    assert.equal((await row(P1))?.quantity, 4);
  });

  // BUG : la quantité est bornée à 999 par requête, mais les ajouts successifs (add, ajout groupé)
  // dépassent la borne sans contrôle. Attendu : total plafonné à 999 ou requête refusée.
  // Observé : 1998 exemplaires enregistrés.
  it.fails("BUG: add ne doit pas dépasser la quantité maximale de 999", async () => {
    await saveOk({ printingId: P1, quantity: 999 });
    const response = await save({ printingId: P1, quantity: 999 });
    const stored = await row(P1);
    assert.ok(response.status === 400 || (stored?.quantity ?? 0) <= 999, `quantité enregistrée : ${stored?.quantity}`);
    assert.ok((stored?.quantity ?? 0) <= 999, `quantité enregistrée : ${stored?.quantity}`);
  });
});

describe.sequential("ajout groupé", () => {
  beforeEach(async () => {
    await prisma.collectionItem.deleteMany({ where: { userId } });
  });

  it("fusionne les doublons du lot et ajoute aux lignes existantes", async () => {
    await saveOk({ printingId: P2, quantity: 1, notes: "gardée" });
    const response = await bulk({
      lines: [
        { printingId: P1, quantity: 2 },
        { printingId: P1, quantity: 3 },
        { printingId: P2, quantity: "4" },
      ],
    });
    assert.equal(response.status, 200);
    assert.equal((await row(P1))?.quantity, 5, "doublons du lot cumulés");
    assert.equal((await row(P2))?.quantity, 5, "ajouté à la ligne existante");
    assert.equal((await row(P2))?.notes, "gardée", "les notes existantes restent");
    assert.equal((await rows()).length, 2, "pas de ligne en double");
  });

  it("ignore les lignes à 0 et les cartes inconnues, refuse un lot sans carte valide", async () => {
    const mixed = await bulk({
      conditionCode: LP,
      lines: [
        { printingId: P1, quantity: 0 },
        { printingId: P3, quantity: 1 },
        { printingId: `inconnue-${stamp}`, quantity: 2 },
      ],
    });
    assert.equal(mixed.status, 200);
    const body = await json<{ items: Line[] }>(mixed);
    assert.deepEqual(
      body.items.map((item) => [item.printingId, item.conditionCode, item.quantity]),
      [[P3, LP, 1]],
    );
    assert.equal((await rows()).length, 1);

    const zeros = await bulk({ lines: [{ printingId: P1, quantity: 0 }] });
    assert.equal(zeros.status, 400);
    assert.match((await json<{ error: string }>(zeros)).error, /Aucune carte/);
    const unknown = await bulk({ lines: [{ printingId: `inconnue-${stamp}`, quantity: 1 }] });
    assert.equal(unknown.status, 400);
    assert.match((await json<{ error: string }>(unknown)).error, /valide/);
    assert.equal((await rows()).length, 1, "un lot refusé n'écrit rien");
  });

  it("refuse quantités invalides, état inconnu, lot vide ou trop gros", async () => {
    const bad = [
      { lines: [{ printingId: P1, quantity: -1 }] },
      { lines: [{ printingId: P1, quantity: 1.5 }] },
      { lines: [{ printingId: P1, quantity: 1000 }] },
      { lines: [{ printingId: P1 }] },
      { lines: [] },
      { lines: "P1" },
      {},
      { conditionCode: "ZZ", lines: [{ printingId: P1, quantity: 1 }] },
      { lines: Array.from({ length: 401 }, () => ({ printingId: P1, quantity: 1 })) },
    ];
    for (const body of bad) {
      const response = await bulk(body);
      assert.equal(response.status, 400, `lot refusé : ${JSON.stringify(body).slice(0, 60)}`);
    }
    assert.equal((await rows()).length, 0);
  });

  it("accepte 400 lignes d'un coup", async () => {
    const response = await bulk({ lines: Array.from({ length: 400 }, () => ({ printingId: P1, quantity: 1 })) });
    assert.equal(response.status, 200);
    assert.equal((await row(P1))?.quantity, 400);
  });
});

describe.sequential("PATCH et DELETE /api/collection/[id]", () => {
  beforeEach(async () => {
    await prisma.collectionItem.deleteMany({ where: { userId } });
  });

  it("changer d'état vers une ligne existante fusionne les quantités", async () => {
    const source = (await saveOk({ printingId: P1, conditionCode: NM, quantity: 2, notes: "source" })).item!;
    const target = (await saveOk({ printingId: P1, conditionCode: LP, quantity: 3, notes: "cible" })).item!;
    const response = await patch(source.id, { conditionCode: LP });
    assert.equal(response.status, 200);
    const result = await json<Mutation>(response);
    assert.equal(result.deletedId, source.id, "la ligne d'origine disparaît");
    assert.equal(result.item?.id, target.id, "la ligne cible est conservée");
    assert.equal(result.item?.quantity, 5);
    assert.equal(result.item?.conditionCode, LP);
    assert.equal(result.item?.notes, "cible");
    assert.equal(await row(P1, nmId), null);
    assert.equal((await rows()).length, 1);
  });

  it("changer d'état avec une quantité fournie l'ajoute à la cible", async () => {
    const source = (await saveOk({ printingId: P1, conditionCode: NM, quantity: 2 })).item!;
    await saveOk({ printingId: P1, conditionCode: LP, quantity: 3 });
    const result = await json<Mutation>(await patch(source.id, { conditionCode: LP, quantity: 4, notes: "fusion" }));
    assert.equal(result.item?.quantity, 7);
    assert.equal(result.item?.notes, "fusion");
  });

  it("changer d'état vers un état libre garde la même ligne", async () => {
    const source = (await saveOk({ printingId: P1, conditionCode: NM, quantity: 2, purchasePrice: "1,5" })).item!;
    const result = await json<Mutation>(await patch(source.id, { conditionCode: LP }));
    assert.equal(result.deletedId, null);
    assert.equal(result.item?.id, source.id);
    assert.equal(result.item?.conditionCode, LP);
    assert.equal(Number(result.item?.purchasePrice), 1.5);
    const same = await json<Mutation>(await patch(source.id, { conditionCode: LP }));
    assert.equal(same.item?.quantity, 2, "même état : rien ne change");
  });

  it("modifie quantité, notes et prix ; quantité 0 supprime", async () => {
    const line = (await saveOk({ printingId: P2, quantity: 2, notes: "a", purchasePrice: "4" })).item!;
    const updated = await json<Mutation>(await patch(line.id, { quantity: 6, notes: null, purchasePrice: "3,25" }));
    assert.equal(updated.item?.quantity, 6);
    assert.equal(updated.item?.notes, null);
    assert.equal(Number(updated.item?.purchasePrice), 3.25);
    const cleared = await json<Mutation>(await patch(line.id, { purchasePrice: null }));
    assert.equal(cleared.item?.purchasePrice, null);
    assert.equal(cleared.item?.purchaseCurrency, null);
    const unchanged = await json<Mutation>(await patch(line.id, {}));
    assert.equal(unchanged.item?.quantity, 6, "un corps vide ne change rien");
    const deleted = await json<Mutation>(await patch(line.id, { quantity: 0 }));
    assert.deepEqual(deleted, { item: null, deletedId: line.id });
    assert.equal(await row(P2), null);
  });

  it("refuse valeurs invalides, état inconnu, ligne inconnue ou d'un autre compte", async () => {
    const line = (await saveOk({ printingId: P2, quantity: 2, notes: "intacte" })).item!;
    const invalid = [
      { quantity: -1 },
      { quantity: 1000 },
      { quantity: 1.5 },
      { purchasePrice: "abc" },
      { purchasePrice: -3 },
      { purchaseCurrency: "JPY" },
      { notes: 12 },
      { conditionCode: "" },
      { conditionCode: "ZZ" },
    ];
    for (const body of invalid) {
      assert.equal((await patch(line.id, body)).status, 400, `refusé : ${JSON.stringify(body)}`);
    }
    assert.equal((await patch(`inconnue-${stamp}`, { quantity: 1 })).status, 400);
    assert.equal((await patch(line.id, { quantity: 9 }, otherToken)).status, 400);
    const stored = await row(P2);
    assert.equal(stored?.quantity, 2);
    assert.equal(stored?.notes, "intacte");
    assert.equal(stored?.conditionId, nmId);
  });

  it("DELETE supprime sa ligne une seule fois, jamais celle d'un autre", async () => {
    const line = (await saveOk({ printingId: P3, quantity: 1 })).item!;
    const foreign = await json<Mutation>(await remove(line.id, otherToken));
    assert.equal(foreign.deletedId, null);
    assert.ok(await row(P3), "la ligne reste");
    const first = await json<Mutation>(await remove(line.id));
    assert.equal(first.deletedId, line.id);
    const second = await json<Mutation>(await remove(line.id));
    assert.equal(second.deletedId, null, "seconde suppression sans effet");
    assert.equal(await row(P3), null);
  });

  it("GET ne renvoie que les lignes du compte, avec les champs attendus", async () => {
    await saveOk({ printingId: P1, quantity: 1, notes: "n", purchasePrice: "2", purchaseCurrency: "USD" });
    const items = (await json<{ items: Line[] }>(await readRoute(request("/api/collection")))).items;
    assert.equal(items.length, 1);
    assert.deepEqual(Object.keys(items[0]).sort(), [
      "addedAt",
      "conditionCode",
      "conditionName",
      "id",
      "notes",
      "printingId",
      "purchaseCurrency",
      "purchasePrice",
      "quantity",
    ]);
    const others = (await json<{ items: Line[] }>(await readRoute(request("/api/collection", {}, otherToken)))).items;
    assert.equal(others.length, 0);
  });
});
