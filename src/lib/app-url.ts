/** URL absolue d'une page de l'app : APP_URL si configurée, sinon l'origine de la requête. */
export function absoluteAppUrl(request: Request, path: string) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return `${configured}${path}`;
  return new URL(path, request.url).toString();
}
