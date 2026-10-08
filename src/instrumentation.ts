import type { Instrumentation } from "next";

// Toute erreur serveur non rattrapée (pages, routes API, server actions) passe par ici.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/monitoring");
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  await reportError(`${context.routeType} ${request.method} ${context.routePath}`, error, {
    path: request.path,
    digest,
  });
};
