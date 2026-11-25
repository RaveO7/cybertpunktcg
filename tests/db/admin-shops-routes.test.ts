/**
 * Routes d'administration des boutiques (file de validation et décision) : 401 sans compte,
 * 403 hors administrateurs, 400 entrée invalide, 404 inconnue, succès. Travaille sur une COPIE de la base
 * SQLite ; comptes et boutiques créés sont supprimés dans afterAll (le User emporte ses boutiques).
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Account = { id: string; token: string };

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let list: typeof import("../../src/app/api/admin/shops/route");
let review: typeof import("../../src/app/api/admin/shops/[id]/review/route");
let sessionCookie: string;
let admin: Account;
let member: Account;
const userIds: string[] = [];
const shopIds: string[] = [];

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function request(path: string, account: Account | null, body?: unknown) {
  const headers = new Headers();
  if (account) headers.set("cookie", `${sessionCookie}=${encodeURIComponent(account.token)}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://127.0.0.1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createShop(label: string) {
  const shop = await prisma.shop.create({
    data: {
      ownerId: member.id,
      slug: `admin-routes-${label}-${stamp}`,
      name: `Boutique ${label} ${stamp}`,
      address: "1 rue du Test",
      city: "Lyon",
      cityKey: "lyon",
      country: "FR",
      lat: 45.76,
      lng: 4.83,
    },
    select: { id: true },
  });
  shopIds.push(shop.id);
  return shop.id;
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-admin-shops-");
  prisma = db.prisma;
  list = await import("../../src/app/api/admin/shops/route");
  review = await import("../../src/app/api/admin/shops/[id]/review/route");
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;
  const makeAccount = async (label: string) => {
    const user = await auth.registerAccount({
      email: `admin.shops.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Admin shops ${label}`,
    });
    userIds.push(user.id);
    return { id: user.id, token: (await auth.createSession(user.id)).token };
  };
  admin = await makeAccount("admin");
  member = await makeAccount("member");
  // Copie de la base : le rôle administrateur n'est posé que sur ce compte jetable.
  await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
});

afterAll(async () => {
  try {
    if (prisma && shopIds.length) await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("GET /api/admin/shops", () => {
  it("refuse sans compte (403) et pour un compte non administrateur (403)", async () => {
    assert.equal((await list.GET(request("/api/admin/shops", null))).status, 403);
    assert.equal((await list.GET(request("/api/admin/shops", member))).status, 403);
  });

  it("400 si le statut est inconnu", async () => {
    assert.equal((await list.GET(request("/api/admin/shops?status=nimporte", admin))).status, 400);
  });

  it("succès : les demandes en attente sont listées par défaut, avec leur propriétaire", async () => {
    const id = await createShop("liste");
    const response = await list.GET(request("/api/admin/shops", admin));
    assert.equal(response.status, 200);
    const { shops } = (await response.json()) as { shops: { id: string; status: string; owner: { id: string } }[] };
    const found = shops.find((shop) => shop.id === id);
    assert.ok(found);
    assert.equal(found.status, "pending");
    assert.equal(found.owner.id, member.id);
    const verified = (await (await list.GET(request("/api/admin/shops?status=verified", admin))).json()) as { shops: { id: string }[] };
    assert.ok(!verified.shops.some((shop) => shop.id === id));
  });
});

describe("POST /api/admin/shops/[id]/review", () => {
  it("refuse sans compte et pour un non-administrateur, sans modifier la boutique", async () => {
    const id = await createShop("droits");
    assert.equal((await review.POST(request(`/api/admin/shops/${id}/review`, null, { decision: "verify" }), params(id))).status, 403);
    assert.equal((await review.POST(request(`/api/admin/shops/${id}/review`, member, { decision: "verify" }), params(id))).status, 403);
    assert.equal((await prisma.shop.findUniqueOrThrow({ where: { id } })).status, "pending");
  });

  it("400 si la décision est inconnue ou si le refus n'a pas de motif", async () => {
    const id = await createShop("invalide");
    for (const body of [{}, { decision: "peut-etre" }, { decision: "reject" }, { decision: "reject", note: "  " }]) {
      assert.equal((await review.POST(request(`/api/admin/shops/${id}/review`, admin, body), params(id))).status, 400, JSON.stringify(body));
    }
    assert.equal((await prisma.shop.findUniqueOrThrow({ where: { id } })).status, "pending");
  });

  it("404 si la boutique n'existe pas", async () => {
    const response = await review.POST(request("/api/admin/shops/inexistante/review", admin, { decision: "verify" }), params("inexistante"));
    assert.equal(response.status, 404);
  });

  it("succès : validation tracée, puis 409 si déjà validée ; refus avec motif", async () => {
    const id = await createShop("valide");
    const ok = await review.POST(request(`/api/admin/shops/${id}/review`, admin, { decision: "verify" }), params(id));
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { shop: { status: string } }).shop.status, "verified");
    const row = await prisma.shop.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "verified");
    assert.equal(row.reviewedById, admin.id);
    assert.ok(row.reviewedAt);
    assert.equal((await review.POST(request(`/api/admin/shops/${id}/review`, admin, { decision: "verify" }), params(id))).status, 409);

    const otherId = await createShop("refuse");
    const rejected = await review.POST(request(`/api/admin/shops/${otherId}/review`, admin, { decision: "reject", note: "Adresse introuvable" }), params(otherId));
    assert.equal(rejected.status, 200);
    const other = await prisma.shop.findUniqueOrThrow({ where: { id: otherId } });
    assert.equal(other.status, "rejected");
    assert.equal(other.reviewNote, "Adresse introuvable");
  });
});
