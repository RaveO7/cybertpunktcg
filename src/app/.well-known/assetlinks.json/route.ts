/**
 * Digital Asset Links : prouve à Android que l'app du Play Store (TWA) et le site ont le même
 * propriétaire. Sans ce fichier, l'app installée affiche la barre d'adresse de Chrome.
 *
 * ANDROID_PACKAGE_NAME : identifiant de l'app (ex. « app.vercel.cybertpunktcg.twa »).
 * ANDROID_CERT_SHA256 : empreintes SHA-256 des clés de signature, séparées par des virgules — celle
 * de la clé d'importation et celle de la signature d'application Google Play (Console Play →
 * Intégrité de l'application).
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const statements =
    packageName && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [];
  return Response.json(statements, { headers: { "cache-control": "public, max-age=3600" } });
}
