import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { describe, it } from "vitest";
import { alertPayload, notifyPriceAlerts, PUSH_TAG, type PushSender, type PushTarget } from "../../src/lib/push";

/**
 * Envoi des notifications d'alerte de prix (src/lib/push.ts) avec un service push simulé et une base
 * en mémoire : regroupement par compte, texte localisé, purge des abonnements expirés, échecs isolés.
 */

type Subscription = { endpoint: string; p256dh: string; auth: string; locale: string; userId: string };

function fakeClient(subscriptions: Subscription[]) {
  const rows = [...subscriptions];
  const printings = [
    { id: "p1", localizedName: "V: Streetkid", card: { canonicalName: "V: Streetkid", name: "V: Streetkid" } },
    { id: "p2", localizedName: null, card: { canonicalName: "Jackie Welles", name: "Jackie Welles" } },
    { id: "p3", localizedName: "Judy Álvarez", card: { canonicalName: "Judy Alvarez", name: "Judy Alvarez" } },
  ];
  const client = {
    pushSubscription: {
      findMany: async ({ where }: { where: { userId: { in: string[] } } }) => rows.filter((row) => where.userId.in.includes(row.userId)),
      deleteMany: async ({ where }: { where: { endpoint: { in: string[] } } }) => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) if (where.endpoint.in.includes(rows[index].endpoint)) rows.splice(index, 1);
        return { count: before - rows.length };
      },
    },
    printing: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => printings.filter((row) => where.id.in.includes(row.id)),
    },
  };
  return { client: client as unknown as PrismaClient, rows };
}

const sub = (userId: string, endpoint: string, locale = "fr"): Subscription => ({
  endpoint: `https://push.example.com/${endpoint}`,
  p256dh: "key",
  auth: "auth",
  locale,
  userId,
});

function recorder(fail: Record<string, number | Error> = {}) {
  const sent: { target: PushTarget; payload: { title: string; body: string; url: string; tag: string } }[] = [];
  const send: PushSender = async (target, payload) => {
    const failure = fail[target.endpoint.split("/").pop()!];
    if (failure instanceof Error) throw failure;
    if (failure) throw Object.assign(new Error(`HTTP ${failure}`), { statusCode: failure });
    sent.push({ target, payload: JSON.parse(payload) });
  };
  return { send, sent };
}

const normalize = (text: string) => text.replace(/\s/g, " ");

describe("texte des notifications", () => {
  it("une alerte : la carte et son prix, dans la langue de l'abonnement", async () => {
    const fr = await alertPayload("fr", [{ name: "V: Streetkid", price: 4.8 }]);
    assert.equal(fr.title, "Prix cible atteint");
    assert.equal(normalize(fr.body), "V: Streetkid est à 4,80 €.");
    assert.equal(fr.url, "/fr/souhaits");
    assert.equal(fr.tag, PUSH_TAG);

    const en = await alertPayload("en", [{ name: "V: Streetkid", price: 4.8 }]);
    assert.equal(en.body, "V: Streetkid is at €4.80.");
    assert.match(en.url, /^\/en\//);
  });

  it("plusieurs alertes : leur nombre", async () => {
    const payload = await alertPayload("fr", [
      { name: "A", price: 1 },
      { name: "B", price: 2 },
      { name: "C", price: 3 },
    ]);
    assert.equal(payload.body, "3 cartes ont atteint votre prix cible.");
  });
});

describe("envoi des notifications", () => {
  it("une seule notification par appareil et par compte, regroupant ses alertes", async () => {
    const { client } = fakeClient([sub("u1", "a"), sub("u1", "b", "en"), sub("u2", "c"), sub("u3", "d")]);
    const { send, sent } = recorder();
    const report = await notifyPriceAlerts(
      client,
      [
        { userId: "u1", printingId: "p1", price: 4.8 },
        { userId: "u1", printingId: "p2", price: 2 },
        { userId: "u1", printingId: "p3", price: 9 },
        { userId: "u2", printingId: "p3", price: 9 },
      ],
      { send },
    );
    assert.deepEqual(report, { users: 2, sent: 3, failed: 0, removed: 0 });
    const byEndpoint = new Map(sent.map((entry) => [entry.target.endpoint.split("/").pop(), entry.payload]));
    assert.deepEqual([...byEndpoint.keys()].sort(), ["a", "b", "c"]);
    assert.equal(byEndpoint.get("a")!.body, "3 cartes ont atteint votre prix cible.");
    assert.equal(byEndpoint.get("b")!.body, "3 cards have reached your target price.");
    assert.equal(normalize(byEndpoint.get("c")!.body), "Judy Álvarez est à 9,00 €.");
    assert.deepEqual(sent[0].target.keys, { p256dh: "key", auth: "auth" });
  });

  it("supprime les abonnements expirés (404, 410) ; un échec n'arrête pas les autres envois", async () => {
    const { client, rows } = fakeClient([sub("u1", "gone"), sub("u1", "missing"), sub("u1", "down"), sub("u1", "boom"), sub("u1", "ok")]);
    const { send, sent } = recorder({ gone: 410, missing: 404, down: 503, boom: new Error("réseau") });
    const report = await notifyPriceAlerts(client, [{ userId: "u1", printingId: "p1", price: 4.8 }], { send });
    assert.deepEqual(report, { users: 1, sent: 1, failed: 2, removed: 2 });
    assert.deepEqual(sent.map((entry) => entry.target.endpoint.split("/").pop()), ["ok"]);
    assert.deepEqual(rows.map((row) => row.endpoint.split("/").pop()).sort(), ["boom", "down", "ok"]);
  });

  it("limite les envois simultanés à 10", async () => {
    const { client } = fakeClient(Array.from({ length: 25 }, (_, index) => sub("u1", `s${index}`)));
    let active = 0;
    let peak = 0;
    const send: PushSender = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    };
    const report = await notifyPriceAlerts(client, [{ userId: "u1", printingId: "p1", price: 1 }], { send });
    assert.equal(report.sent, 25);
    assert.equal(peak, 10);
  });

  it("sans alerte ou sans clés VAPID : aucun envoi", async () => {
    const { client } = fakeClient([sub("u1", "a")]);
    const { send, sent } = recorder();
    assert.deepEqual(await notifyPriceAlerts(client, [], { send }), { users: 0, sent: 0, failed: 0, removed: 0 });

    const saved = { ...process.env };
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const logs: string[] = [];
    try {
      const report = await notifyPriceAlerts(client, [{ userId: "u1", printingId: "p1", price: 1 }], { log: (line) => logs.push(line) });
      assert.equal(report.skipped, "no-keys");
      await notifyPriceAlerts(client, [{ userId: "u1", printingId: "p1", price: 1 }], { log: (line) => logs.push(line) });
      assert.equal(logs.length, 1, "journalisé une seule fois");
    } finally {
      process.env = saved;
    }
    assert.equal(sent.length, 0);
  });
});
