// Notifications Web Push des alertes de prix : abonnements des appareils (/api/push/subscribe) et envoi
// après l'import quotidien des prix (src/lib/price-import.ts). Clés VAPID dans l'environnement ; sans
// elles, rien n'est envoyé et l'option des réglages est masquée.
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { formatterFor, translatorFor } from "@/i18n/server";
import { routePath } from "@/i18n/paths";
import { prisma } from "./prisma";

/** Regroupe les notifications d'alerte : une nouvelle remplace la précédente au lieu de s'empiler. */
export const PUSH_TAG = "price-alerts";
/** Envois simultanés au plus. */
const CONCURRENCY = 10;
/** Durée de conservation par le service push si l'appareil est éteint : un jour, jusqu'à l'import suivant. */
const TTL_SECONDS = 24 * 60 * 60;

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string }; locale?: string };

/** Enregistre l'appareil pour ce compte. Un endpoint déjà connu passe au compte courant. */
export async function savePushSubscription(userId: string, input: PushSubscriptionInput, fallbackLocale: Locale) {
  const locale = isLocale(input.locale) ? input.locale : fallbackLocale;
  const data = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, locale };
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });
  return { active: true, locale };
}

/** Désabonne l'appareil, seulement s'il appartient à ce compte. */
export async function removePushSubscription(userId: string, endpoint: string) {
  const result = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { removed: result.count > 0 };
}

export type TriggeredAlert = { userId: string; printingId: string; price: number };
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Envoi d'une notification ; l'erreur porte `statusCode` quand le service push répond en erreur. */
export type PushSender = (target: PushTarget, payload: string) => Promise<unknown>;
export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushReport = { users: number; sent: number; failed: number; removed: number; skipped?: "no-keys" };

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function vapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

let missingKeysLogged = false;

async function webPushSender(config: VapidConfig): Promise<PushSender> {
  const { default: webPush } = await import("web-push");
  const details = { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey };
  return (target, payload) =>
    webPush.sendNotification(target, payload, { TTL: TTL_SECONDS, topic: PUSH_TAG, urgency: "normal", vapidDetails: details });
}

/** Texte de la notification d'un compte : la carte et son prix s'il n'y a qu'une alerte, sinon le nombre. */
export async function alertPayload(locale: Locale, alerts: { name: string; price: number }[]): Promise<PushPayload> {
  const t = await translatorFor(locale, "wishlist");
  const format = formatterFor(locale);
  const [first] = alerts;
  const body =
    alerts.length === 1
      ? t("push.one", { name: first.name, price: format.number(first.price, { style: "currency", currency: "EUR" }) })
      : t("push.many", { count: alerts.length });
  return { title: t("push.title"), body, url: routePath("/souhaits", locale), tag: PUSH_TAG };
}

/** Exécute les tâches avec au plus `limit` en cours. */
async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function statusOf(error: unknown) {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

/**
 * Une notification par appareil abonné de chaque compte qui a de nouvelles alertes. Les abonnements
 * que le service push déclare expirés (404, 410) sont supprimés ; un échec n'arrête pas les autres envois.
 */
export async function notifyPriceAlerts(
  client: PrismaClient,
  alerts: TriggeredAlert[],
  options: { send?: PushSender; log?: (message: string) => void } = {},
): Promise<PushReport> {
  const log = options.log ?? console.log;
  const byUser = new Map<string, TriggeredAlert[]>();
  for (const alert of alerts) byUser.set(alert.userId, [...(byUser.get(alert.userId) ?? []), alert]);
  const report: PushReport = { users: 0, sent: 0, failed: 0, removed: 0 };
  if (byUser.size === 0) return report;

  let send = options.send;
  if (!send) {
    const config = vapidConfig();
    if (!config) {
      if (!missingKeysLogged) log("Notifications push désactivées : clés VAPID absentes.");
      missingKeysLogged = true;
      return { ...report, skipped: "no-keys" };
    }
    send = await webPushSender(config);
  }

  const subscriptions = await client.pushSubscription.findMany({
    where: { userId: { in: [...byUser.keys()] } },
    select: { endpoint: true, p256dh: true, auth: true, locale: true, userId: true },
  });
  if (subscriptions.length === 0) return report;
  const printings = await client.printing.findMany({
    where: { id: { in: alerts.map((alert) => alert.printingId) } },
    select: { id: true, localizedName: true, card: { select: { canonicalName: true, name: true } } },
  });
  const names = new Map(printings.map((row) => [row.id, row.localizedName || row.card.canonicalName || row.card.name]));
  report.users = new Set(subscriptions.map((row) => row.userId)).size;

  const payloads = new Map<string, Promise<string>>();
  const payloadFor = (userId: string, locale: Locale) => {
    const key = `${userId}|${locale}`;
    if (!payloads.has(key)) {
      const entries = byUser.get(userId)!.map((alert) => ({ name: names.get(alert.printingId) ?? "?", price: alert.price }));
      payloads.set(key, alertPayload(locale, entries).then((payload) => JSON.stringify(payload)));
    }
    return payloads.get(key)!;
  };

  const expired: string[] = [];
  await pool(subscriptions, CONCURRENCY, async (row) => {
    const locale = isLocale(row.locale) ? row.locale : DEFAULT_LOCALE;
    try {
      await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, await payloadFor(row.userId, locale));
      report.sent += 1;
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 410) expired.push(row.endpoint);
      else report.failed += 1;
    }
  });
  if (expired.length) {
    report.removed = (await client.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } })).count;
  }
  return report;
}
