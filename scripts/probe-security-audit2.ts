/**
 * Probe du second audit : tente de casser l'app AVANT correctifs.
 * Exit 0 = probe exécuté (imprime findings). Ne remplace pas les tests de régression.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { registerAccount } from "../src/lib/auth";
import {
  appOrigin,
  createOAuthState,
  loginWithOAuth,
  verifyOAuthState,
} from "../src/lib/oauth";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cleanupIds: string[] = [];
const findings: { id: string; severity: string; reproduced: boolean; detail: string }[] = [];

function note(id: string, severity: string, reproduced: boolean, detail: string) {
  findings.push({ id, severity, reproduced, detail });
  console.log(`${reproduced ? "PWN" : "OK "} [${severity}] ${id}: ${detail}`);
}

async function probeOAuthEmailLinkTakeover() {
  const email = `prejack.${stamp}@example.com`;
  const victim = await registerAccount({
    email,
    password: "motdepasse-robuste",
    displayName: "Victime",
    localUserId: null,
  });
  cleanupIds.push(victim.id);
  await prisma.collectionItem.deleteMany({ where: { userId: victim.id } });

  try {
    const attackerSessionUser = await loginWithOAuth(
      {
        provider: "google",
        providerUserId: `google-attacker-${stamp}`,
        email,
        displayName: "Attaquant",
      },
      null,
    );
    const linked = await prisma.oAuthAccount.findFirst({
      where: { userId: victim.id, provider: "google" },
    });
    const takeover = attackerSessionUser.id === victim.id && Boolean(linked);
    note(
      "oauth-email-autolink",
      "high",
      takeover,
      takeover
        ? `OAuth a lié Google à ${victim.id} sans preuve → session sur le compte password existant`
        : `refus ou autre compte (${attackerSessionUser.id})`,
    );
  } catch (error) {
    note(
      "oauth-email-autolink",
      "high",
      false,
      `bloqué: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function probeWeakOAuthState() {
  const prev = process.env.OAUTH_STATE_SECRET;
  const google = process.env.GOOGLE_CLIENT_SECRET;
  const apple = process.env.APPLE_CLIENT_ID;
  delete process.env.OAUTH_STATE_SECRET;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APPLE_CLIENT_ID;

  try {
    let forged = false;
    try {
      const body = Buffer.from(
        JSON.stringify({
          n: "probe",
          p: "google",
          l: null,
          e: Date.now() + 60_000,
        }),
        "utf8",
      ).toString("base64url");
      const sig = createHmac("sha256", "cptcg-dev-oauth-state").update(body).digest("base64url");
      const verified = verifyOAuthState(`${body}.${sig}`, "google");
      forged = Boolean(verified);
    } catch {
      forged = false;
    }
    note(
      "oauth-state-fallback-secret",
      "high",
      forged,
      forged
        ? "state forgeable avec le secret hardcodé cptcg-dev-oauth-state"
        : "forge refusée (secret absent ou fail-closed)",
    );
  } finally {
    if (prev !== undefined) process.env.OAUTH_STATE_SECRET = prev;
    else delete process.env.OAUTH_STATE_SECRET;
    if (google !== undefined) process.env.GOOGLE_CLIENT_SECRET = google;
    if (apple !== undefined) process.env.APPLE_CLIENT_ID = apple;
  }
}

function probeForwardedHost() {
  const prev = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    const request = new Request("http://127.0.0.1:3000/api/auth/oauth/google", {
      headers: {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    });
    const origin = appOrigin(request);
    const poisoned = origin === "https://evil.example";
    note(
      "forwarded-host-poison",
      "medium",
      poisoned,
      poisoned
        ? `appOrigin → ${origin} (redirect_uri / cookies empoisonnés)`
        : `appOrigin reste sûr: ${origin}`,
    );
  } finally {
    if (prev !== undefined) process.env.APP_URL = prev;
    else delete process.env.APP_URL;
  }
}

async function probeOrphanClaim() {
  const orphan = await prisma.user.create({ data: { displayName: "Orphelin" } });
  cleanupIds.push(orphan.id);
  const printing = await prisma.printing.findFirst({ where: { isActive: true }, select: { id: true } });
  const condition = await prisma.condition.findFirst({ select: { id: true } });
  assert.ok(printing && condition);
  await prisma.collectionItem.create({
    data: {
      userId: orphan.id,
      printingId: printing.id,
      conditionId: condition.id,
      quantity: 9,
      notes: "a-voler",
    },
  });
  const attacker = await registerAccount({
    email: `voleur.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Voleur",
    localUserId: orphan.id,
  });
  cleanupIds.push(attacker.id);
  const stolen = await prisma.collectionItem.findFirst({
    where: { userId: attacker.id, notes: "a-voler" },
  });
  const orphanGone = (await prisma.user.findUnique({ where: { id: orphan.id } })) === null;
  note(
    "orphan-localuserid-claim",
    "medium",
    Boolean(stolen) && orphanGone,
    stolen && orphanGone
      ? `connaissance du cuid orphelin → fusion dans ${attacker.id}`
      : "reprise d'orphelin refusée",
  );
}

async function probeBulkCap() {
  const { saveCollectionBatch } = await import("../src/lib/collection-mutate");
  const user = await registerAccount({
    email: `bulk.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: "Bulk",
    localUserId: null,
  });
  cleanupIds.push(user.id);
  const huge = Array.from({ length: 500 }, (_, i) => ({
    printingId: `fake-${i}`,
    quantity: 1,
  }));
  let rejectedEarly = false;
  try {
    await saveCollectionBatch(user.id, { conditionCode: "NM", lines: huge });
  } catch (error) {
    rejectedEarly = error instanceof Error && /Trop de cartes/i.test(error.message);
  }
  note(
    "bulk-size-cap",
    "low",
    !rejectedEarly,
    rejectedEarly
      ? "cap 400 appliqué dans saveCollectionBatch"
      : "cap non appliqué ou autre erreur (route peut encore parser un énorme JSON avant)",
  );
}

async function main() {
  await probeOAuthEmailLinkTakeover();
  await probeWeakOAuthState();
  probeForwardedHost();
  await probeOrphanClaim();
  await probeBulkCap();
  // sanity: createOAuthState with current env
  try {
    const state = createOAuthState("google", null);
    assert.ok(verifyOAuthState(state, "google"));
  } catch (error) {
    note(
      "oauth-state-create",
      "info",
      false,
      `createOAuthState: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log(JSON.stringify({ findings }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cleanupIds.length) {
      await prisma.oAuthAccount.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.collectionItem.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupIds } } });
    }
    await prisma.$disconnect();
  });
