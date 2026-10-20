// Abonnement Web Push de l'appareil, côté navigateur (alertes de prix). Le serveur : src/lib/push.ts.

/** Clé publique VAPID ; absente (local, preview), l'option est masquée. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;

const SUBSCRIBE_URL = "/api/push/subscribe";

/**
 * - `unsupported` : navigateur sans notifications push ;
 * - `ios-install` : iPhone ou iPad hors de l'app installée (le push n'existe que dans la PWA, iOS 16.4+) ;
 * - `denied` : notifications bloquées pour le site ; `off` / `on` : appareil non abonné / abonné.
 */
export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Enregistrement du service worker : celui déjà actif, sinon attendu quelques secondes. */
async function registration(wait: boolean) {
  const current = await navigator.serviceWorker.getRegistration();
  if (current || !wait) return current ?? null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
  ]);
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  return (await registration(false))?.pushManager.getSubscription() ?? null;
}

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function sendSubscription(subscription: PushSubscription, locale: string) {
  const response = await fetch(SUBSCRIBE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...subscription.toJSON(), locale }),
  });
  if (!response.ok) throw new Error(`push-subscribe ${response.status}`);
}

/** Autorisation des notifications : API Permissions si disponible (à jour même en navigateur piloté), sinon `Notification`. */
async function notificationPermission(): Promise<NotificationPermission> {
  try {
    const status = await navigator.permissions?.query({ name: "notifications" });
    if (status) return status.state === "prompt" ? "default" : status.state;
  } catch {
    // Nom de permission inconnu de ce navigateur.
  }
  return Notification.permission;
}

/** État de l'appareil. Un abonnement existant est renvoyé au serveur (rattaché au compte courant). */
export async function readPushState(locale: string): Promise<PushState> {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!pushSupported()) return "unsupported";
  if ((await notificationPermission()) === "denied") return "denied";
  const subscription = await currentSubscription();
  if (!subscription) return "off";
  await sendSubscription(subscription, locale).catch(() => undefined);
  return "on";
}

/** Demande l'autorisation, abonne l'appareil puis l'enregistre ; rien n'est gardé en cas de refus ou d'échec. */
export async function enablePush(locale: string): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const worker = await registration(true);
  if (!worker) throw new Error("service-worker");
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  try {
    await sendSubscription(subscription, locale);
  } catch (error) {
    await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
  return "on";
}

/** Désabonne l'appareil, côté serveur puis navigateur (réglages, déconnexion). Ne lève jamais d'exception. */
export async function disablePush(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await fetch(SUBSCRIBE_URL, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  } catch {
    // Service worker indisponible : rien à désabonner.
  }
}
