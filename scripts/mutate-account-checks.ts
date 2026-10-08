import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mutations: { name: string; file: string; from: string; to: string }[] = [
  {
    name: "la collection ignore le compte",
    file: "src/lib/catalog.ts",
    from: "where: { userId, quantity: { gt: 0 } }",
    to: "where: { quantity: { gt: 0 } }",
  },
  {
    name: "suppression possible sur le compte d'un autre",
    file: "src/lib/collection-mutate.ts",
    from: "const current = await prisma.collectionItem.findFirst({ where: { id, userId } });\n  if (!current) return { item: null, deletedId: null };",
    to: "const current = await prisma.collectionItem.findFirst({ where: { id } });\n  if (!current) return { item: null, deletedId: null };",
  },
  {
    name: "modification possible sur le compte d'un autre",
    file: "src/lib/collection-mutate.ts",
    from: "const current = await tx.collectionItem.findFirst({\n      where: { id, userId },\n      include,\n    });",
    to: "const current = await tx.collectionItem.findFirst({\n      where: { id },\n      include,\n    });",
  },
  {
    name: "l'enregistrement n'est plus lié au compte connecté",
    file: "src/app/api/collection/route.ts",
    from: "const result = await saveCollectionLine(user.id, parsed.data);",
    to: "const result = await saveCollectionLine(\"compte-inconnu\", parsed.data);",
  },
  {
    name: "le mot de passe n'est plus vérifié",
    file: "src/lib/auth.ts",
    from: "if (!user?.passwordHash || !user.email || !ok) return null;",
    to: "if (!user?.passwordHash || !user.email) return null;",
  },
  {
    name: "une session périmée reste acceptée",
    file: "src/lib/auth.ts",
    from: "if (session.expiresAt.getTime() <= Date.now()) {\n    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);\n    return null;\n  }",
    to: "if (false && session.expiresAt.getTime() <= Date.now()) {\n    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);\n    return null;\n  }",
  },
  {
    name: "la déconnexion laisse le cookie actif",
    file: "src/lib/auth.ts",
    from: "await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });",
    to: "await Promise.resolve(token);",
  },
  {
    name: "le cookie de session expire tout de suite",
    file: "src/lib/auth.ts",
    from: "response.cookies.set(sessionCookie(request, token, expiresAt, SESSION_MAX_AGE_SECONDS));",
    to: "response.cookies.set(sessionCookie(request, token, expiresAt, 0));",
  },
  {
    name: "le cookie est marqué Secure même en HTTP",
    file: "src/lib/auth.ts",
    from: "function cookieSecure(request: Request) {\n  const configured = process.env.APP_URL?.trim();\n  if (configured) return configured.startsWith(\"https:\");\n  if (process.env.TRUST_PROXY === \"1\") {\n    const forwarded = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n    if (forwarded) return forwarded === \"https\";\n  }\n  return new URL(request.url).protocol === \"https:\";\n}",
    to: "function cookieSecure(_request: Request) {\n  return true;\n}",
  },
  {
    name: "la connexion distingue les majuscules de l'e-mail",
    file: "src/app/api/auth/login/route.ts",
    from: "const email = normalizeEmail(body.email);",
    to: "const email = typeof body.email === \"string\" ? body.email.trim() : null;",
  },
  {
    name: "OAuth rattache silencieusement un compte existant",
    file: "src/lib/oauth.ts",
    from: "if (byEmail) {\n    // Pas de liaison silencieuse : un compte password pré-enregistré avec le même e-mail\n    // ne doit pas être pris via OAuth sans preuve (prise de contrôle).\n    throw new Error(\"ACCOUNT_EXISTS\");\n  }",
    to: "if (byEmail) {\n    await prisma.oAuthAccount.create({\n      data: {\n        userId: byEmail.id,\n        provider: profile.provider,\n        providerUserId: profile.providerUserId,\n      },\n    });\n    return byEmail;\n  }",
  },
  {
    name: "le state OAuth redevient forgeable sans secret",
    file: "src/lib/oauth.ts",
    from: "if (!secret || secret.length < 16) {\n    throw new Error(\"OAUTH_STATE_SECRET_MISSING\");\n  }\n  return secret;",
    to: "return secret || \"cptcg-dev-oauth-state\";",
  },
  {
    name: "l'origine OAuth fait confiance à x-forwarded-host",
    file: "src/lib/oauth.ts",
    from: "if (process.env.TRUST_PROXY === \"1\") {\n    const forwardedHost = request.headers.get(\"x-forwarded-host\")?.split(\",\")[0]?.trim();\n    const forwardedProto = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n    if (forwardedHost) {\n      return `${forwardedProto === \"http\" ? \"http\" : \"https\"}://${forwardedHost}`;\n    }\n  }\n  return new URL(request.url).origin;",
    to: "const forwardedHost = request.headers.get(\"x-forwarded-host\")?.split(\",\")[0]?.trim();\n  const forwardedProto = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n  if (forwardedHost) {\n    return `${forwardedProto === \"http\" ? \"http\" : \"https\"}://${forwardedHost}`;\n  }\n  return new URL(request.url).origin;",
  },
];

function read(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

function write(file: string, contents: string) {
  writeFileSync(path.join(root, file), contents);
}

function runTests() {
  return spawnSync("npx", ["vitest", "run", "tests/db/account.test.ts", "tests/db/security.test.ts"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
}

const originals = new Map<string, string>();
for (const mutation of mutations) {
  if (!originals.has(mutation.file)) originals.set(mutation.file, read(mutation.file));
  if (!originals.get(mutation.file)?.includes(mutation.from)) {
    console.error(`extrait introuvable pour: ${mutation.name}`);
    process.exit(1);
  }
}

function restore() {
  for (const [file, contents] of originals) write(file, contents);
}

const baseline = runTests();
if (baseline.status !== 0) {
  console.error(baseline.stdout);
  console.error(baseline.stderr);
  console.error("Les tests échouent déjà sans bug introduit.");
  process.exit(1);
}
console.log("Référence: les tests passent.");

const survived: string[] = [];
try {
  for (const mutation of mutations) {
    const source = originals.get(mutation.file);
    if (source == null || !source.includes(mutation.from)) {
      throw new Error(`extrait introuvable pour: ${mutation.name}`);
    }
    write(mutation.file, source.replace(mutation.from, mutation.to));
    const result = runTests();
    restore();
    if (result.status === 0) {
      survived.push(mutation.name);
      console.log(`MANQUÉ: ${mutation.name}`);
    } else {
      const detail = `${result.stderr}\n${result.stdout}`.trim().split("\n").at(-1);
      console.log(`DÉTECTÉ: ${mutation.name}${detail ? ` — ${detail}` : ""}`);
    }
  }
} finally {
  restore();
}

for (const [file, contents] of originals) {
  if (read(file) !== contents) {
    console.error(`Le fichier n'a pas été restauré: ${file}`);
    process.exit(1);
  }
}

if (survived.length > 0) {
  console.error(`Bugs non détectés: ${survived.join(", ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, mutations: mutations.length }));
