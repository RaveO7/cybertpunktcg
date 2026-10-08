import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { afterAll, beforeAll, describe, it } from "vitest";
import { authenticate, registerAccount } from "../../src/lib/auth";
import { hashPassword, verifyPassword } from "../../src/lib/password";
import { prisma } from "../../src/lib/prisma";

const stamp = Date.now().toString(36);
const email = `auth-${stamp}@example.com`;
const password = "motdepasse";
const createdUserIds: string[] = [];

function legacyHash(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64url")}`;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("mots de passe", () => {
  it("stocke le mot de passe tel quel et le vérifie", async () => {
    const roundtrip = await hashPassword(password);
    assert.equal(roundtrip, password, "password stored in clear");
    assert.ok(await verifyPassword(password, roundtrip));
    assert.equal(await verifyPassword("autre-mot", roundtrip), false, "password mismatch accepted");
  });

  it("accepte encore les anciens hachages scrypt", async () => {
    const legacy = legacyHash(password);
    assert.ok(await verifyPassword(password, legacy), "legacy scrypt hash rejected");
    assert.equal(await verifyPassword("autre-mot", legacy), false, "legacy mismatch accepted");
  });
});

describe("inscription et connexion", () => {
  let localId: string;
  let accountId: string;

  beforeAll(async () => {
    const local = await prisma.user.create({ data: { displayName: "Collection locale" } });
    createdUserIds.push(local.id);
    localId = local.id;
  });

  it("crée un compte sans réclamer l'utilisateur orphelin", async () => {
    const claimed = await registerAccount({ email, password, displayName: "Compte", localUserId: localId });
    createdUserIds.push(claimed.id);
    accountId = claimed.id;
    assert.notEqual(claimed.id, localId, "orphan must not be claimed on register");
    assert.equal(claimed.email, email);
    assert.equal(claimed.displayName, "Compte");
    assert.ok(await prisma.user.findUnique({ where: { id: localId } }), "orphan user deleted unexpectedly");
  });

  it("refuse un e-mail déjà pris", async () => {
    const duplicate = await registerAccount({ email, password, displayName: null, localUserId: null }).then(
      () => "created",
      (error: unknown) => (error instanceof Error ? error.message : "error"),
    );
    assert.equal(duplicate, "EMAIL_TAKEN");
  });

  it("authentifie seulement le bon mot de passe", async () => {
    assert.equal((await authenticate(email, password))?.id, accountId);
    assert.equal(await authenticate(email, "mauvaisxx"), null, "bad password accepted");
    assert.equal(await authenticate(`absent-${stamp}@example.com`, password), null, "unknown accepted");
  });

  it("remplace un ancien hachage à la connexion", async () => {
    await prisma.user.update({ where: { id: accountId }, data: { passwordHash: legacyHash(password) } });
    assert.equal((await authenticate(email, password))?.id, accountId, "legacy login");
    const upgraded = await prisma.user.findUnique({ where: { id: accountId } });
    assert.equal(upgraded?.passwordHash, password, "legacy hash not replaced by clear password");
  });
});
