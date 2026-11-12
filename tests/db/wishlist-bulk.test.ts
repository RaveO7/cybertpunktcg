/**
 * Ajout groupé à la liste de souhaits (cartes manquantes d'un deck) : POST /api/wishlist/bulk.
 * Compte de test en @example.com, supprimé à la fin (cascade sur ses souhaits) même en cas d'échec.
 * Les tirages du catalogue sont seulement lus, jamais modifiés.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { POST as bulkRoute } from "../../src/app/api/wishlist/bulk/route";
import { POST as saveRoute } from "../../src/app/api/wishlist/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";
import type { WishlistItemDTO } from "../../src/lib/types";

type BulkBody = { added: number; alreadyPresent: number; items: WishlistItemDTO[]; error?: string };

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
let token: string;
let userId: string;
let printingIds: string[];

function request(path: string, body: unknown, session: string | null = token) {
  const headers = new Headers({ "content-type": "application/json" });
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}`);
  return new Request(`http://127.0.0.1${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function bulk(body: unknown, session: string | null = token) {
  const response = await bulkRoute(request("/api/wishlist/bulk", body, session));
  return { status: response.status, body: (await response.json()) as BulkBody };
}

beforeAll(async () => {
  const printings = await prisma.printing.findMany({ where: { isActive: true }, select: { id: true }, take: 4, orderBy: { id: "asc" } });
  assert.equal(printings.length, 4, "le catalogue local doit contenir au moins 4 tirages actifs");
  printingIds = printings.map((printing) => printing.id);
  const user = await registerAccount({
    email: `wishlist.bulk.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Souhaits groupés",
  });
  createdUserIds.push(user.id);
  userId = user.id;
  token = (await createSession(user.id)).token;
});

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe.sequential("ajout groupé à la liste de souhaits", () => {
  it("refuse sans session, liste vide ou plus de 200 tirages", async () => {
    assert.equal((await bulk({ printingIds }, null)).status, 401);
    assert.equal((await bulk({ printingIds: [] })).status, 400);
    assert.equal((await bulk({ printingIds: Array.from({ length: 201 }, (_, index) => `p${index}`) })).status, 400);
  });

  it("tirage inconnu : rien n'est ajouté", async () => {
    const result = await bulk({ printingIds: [printingIds[0], `inconnu-${stamp}`] });
    assert.equal(result.status, 400);
    assert.equal(await prisma.wishlistItem.count({ where: { userId } }), 0);
  });

  it("3 ajoutés, 1 déjà présent dont la cible et les notes sont conservées", async () => {
    const saved = await saveRoute(
      request("/api/wishlist", { printingId: printingIds[0], targetPrice: "4,20", notes: "garder" }),
    );
    assert.equal(saved.status, 200);
    const before = ((await saved.json()) as { item: WishlistItemDTO }).item;

    const result = await bulk({ printingIds: [...printingIds, printingIds[1]] });
    assert.equal(result.status, 200);
    assert.equal(result.body.added, 3);
    assert.equal(result.body.alreadyPresent, 1);
    assert.equal(result.body.items.length, 4);

    const kept = result.body.items.find((item) => item.printingId === printingIds[0])!;
    assert.equal(kept.id, before.id);
    assert.equal(kept.targetPrice, "4.20");
    assert.equal(kept.notes, "garder");
    for (const item of result.body.items.filter((entry) => entry.printingId !== printingIds[0])) {
      assert.equal(item.targetPrice, null);
      assert.equal(item.alertAt, null);
    }
    assert.equal(await prisma.wishlistItem.count({ where: { userId } }), 4);

    // Relancer n'ajoute rien.
    const again = await bulk({ printingIds });
    assert.deepEqual([again.body.added, again.body.alreadyPresent], [0, 4]);
  });
});
