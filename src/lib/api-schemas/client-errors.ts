import { z } from "zod";

/** Erreur JavaScript remontée par le navigateur (src/lib/client/error-reporting.ts), tronquée à la source. */
export const clientErrorSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(4000).optional(),
  path: z.string().max(500),
  // Page contrôlée par le service worker (qui peut la servir depuis son cache).
  serviceWorker: z.boolean(),
});
