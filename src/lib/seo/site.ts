/** Adresse publique du site, base des URL canoniques, du sitemap et des images de partage. */

type Env = Record<string, string | undefined>;

const LOCAL_URL = "http://localhost:3000";

/** Origine du site sans barre finale : APP_URL, sinon le domaine de production Vercel, sinon localhost. */
export function siteUrl(env: Env = process.env): string {
  const configured = env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/+$/, "");
  if (vercel) return /^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`;
  return LOCAL_URL;
}

/** URL absolue d'un chemin du site. */
export function absoluteUrl(path: string, env: Env = process.env): string {
  return `${siteUrl(env)}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Déploiement à indexer : la production Vercel, ou hors Vercel un site dont l'adresse est configurée.
 * Les prévisualisations Vercel (VERCEL_ENV=preview) ne doivent jamais être indexées.
 */
export function isProductionDeployment(env: Env = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return Boolean(env.APP_URL?.trim());
}
