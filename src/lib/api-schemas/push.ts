import { z } from "zod";
import { isAllowedPushEndpoint } from "../push-endpoint";

/** Clé d'un abonnement Web Push (base64url). */
const pushKey = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_=-]+$/);
const pushEndpoint = z.url({ protocol: /^https$/ }).max(2048).refine(isAllowedPushEndpoint);

/** Abonnement Web Push d'un appareil (`PushSubscription.toJSON()`), et langue des notifications. */
export const pushSubscribeSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: pushKey, auth: pushKey }),
  locale: z.string().max(8).optional(),
});

export const pushUnsubscribeSchema = z.object({ endpoint: pushEndpoint });
