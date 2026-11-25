import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Une mutation peut demander plusieurs remplacements : une garde doublée (filtre de lecture et d'écriture)
// ne devient un vrai bug qu'une fois les deux retirées.
const mutations: { name: string; file: string; edits: { from: string; to: string }[] }[] = [
  {
    name: "la collection ignore le compte",
    file: "src/lib/catalog.ts",
    edits: [{ from: "where: { userId, quantity: { gt: 0 } }", to: "where: { quantity: { gt: 0 } }" }],
  },
  {
    name: "suppression possible sur le compte d'un autre",
    file: "src/lib/collection-mutate.ts",
    edits: [{ from: "const current = await prisma.collectionItem.findFirst({ where: { id, userId } });\n  if (!current) return { item: null, deletedId: null };", to: "const current = await prisma.collectionItem.findFirst({ where: { id } });\n  if (!current) return { item: null, deletedId: null };" }],
  },
  {
    name: "modification possible sur le compte d'un autre",
    file: "src/lib/collection-mutate.ts",
    edits: [
      { from: "const current = await tx.collectionItem.findFirst({\n      where: { id, userId },\n      include,\n    });", to: "const current = await tx.collectionItem.findFirst({\n      where: { id },\n      include,\n    });" },
      { from: "const saved = await tx.collectionItem.update({\n      where: { id: current.id, userId },\n      data: { conditionId", to: "const saved = await tx.collectionItem.update({\n      where: { id: current.id },\n      data: { conditionId" },
    ],
  },
  {
    name: "l'enregistrement n'est plus lié au compte connecté",
    file: "src/app/api/collection/route.ts",
    edits: [{ from: "const result = await saveCollectionLine(user.id, parsed.data);", to: "const result = await saveCollectionLine(\"compte-inconnu\", parsed.data);" }],
  },
  {
    name: "le mot de passe n'est plus vérifié",
    file: "src/lib/auth.ts",
    edits: [{ from: "if (!user?.passwordHash || !user.email || !ok) return null;", to: "if (!user?.passwordHash || !user.email) return null;" }],
  },
  {
    name: "une session périmée reste acceptée",
    file: "src/lib/auth.ts",
    edits: [{ from: "if (session.expiresAt.getTime() <= Date.now()) {\n    await dropSession(session.id);\n    return null;\n  }", to: "if (false && session.expiresAt.getTime() <= Date.now()) {\n    await dropSession(session.id);\n    return null;\n  }" }],
  },
  {
    name: "la déconnexion laisse le cookie actif",
    file: "src/lib/auth.ts",
    edits: [{ from: "await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });", to: "await Promise.resolve(token);" }],
  },
  {
    name: "le cookie de session expire tout de suite",
    file: "src/lib/auth.ts",
    edits: [{ from: "response.cookies.set(sessionCookie(request, token, expiresAt, SESSION_MAX_AGE_SECONDS));", to: "response.cookies.set(sessionCookie(request, token, expiresAt, 0));" }],
  },
  {
    name: "le cookie est marqué Secure même en HTTP",
    file: "src/lib/auth.ts",
    edits: [{ from: "export function cookieSecure(request: Request) {\n  const configured = process.env.APP_URL?.trim();\n  if (configured) return configured.startsWith(\"https:\");\n  if (process.env.TRUST_PROXY === \"1\") {\n    const forwarded = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n    if (forwarded) return forwarded === \"https\";\n  }\n  return new URL(request.url).protocol === \"https:\";\n}", to: "export function cookieSecure(_request: Request) {\n  return true;\n}" }],
  },
  {
    name: "la connexion distingue les majuscules de l'e-mail",
    file: "src/lib/auth.ts",
    edits: [{ from: "const email = value.trim().toLowerCase();", to: "const email = value.trim();" }],
  },
  {
    name: "le blocage par e-mail est ignoré",
    file: "src/app/api/auth/login/route.ts",
    edits: [{ from: "if (blocked > 0) {", to: "if (false && blocked > 0) {" }],
  },
  {
    name: "les échecs de connexion par e-mail ne sont pas comptés",
    file: "src/app/api/auth/login/route.ts",
    edits: [{ from: "    await rateLimit(failureKey, EMAIL_FAILURE_LIMIT, EMAIL_FAILURE_WINDOW_MS);\n", to: "" }],
  },
  {
    name: "la limite par e-mail dépend de l'IP",
    file: "src/app/api/auth/login/route.ts",
    edits: [{ from: "const failureKey = `login-fail:${createHash(\"sha256\").update(email).digest(\"hex\").slice(0, 32)}`;", to: "const failureKey = clientKey(request, `login-fail:${createHash(\"sha256\").update(email).digest(\"hex\").slice(0, 32)}`);" }],
  },
  {
    name: "une connexion réussie consomme la limite par e-mail",
    file: "src/app/api/auth/login/route.ts",
    edits: [{ from: "const user = await authenticate(email, password);\n  if (!user) {\n    await rateLimit(failureKey, EMAIL_FAILURE_LIMIT, EMAIL_FAILURE_WINDOW_MS);\n", to: "await rateLimit(failureKey, EMAIL_FAILURE_LIMIT, EMAIL_FAILURE_WINDOW_MS);\n  const user = await authenticate(email, password);\n  if (!user) {\n" }],
  },
  {
    name: "OAuth rattache silencieusement un compte existant",
    file: "src/lib/oauth.ts",
    edits: [{ from: "if (byEmail) {\n    // Pas de liaison silencieuse : un compte password pré-enregistré avec le même e-mail\n    // ne doit pas être pris via OAuth sans preuve (prise de contrôle).\n    throw new Error(\"ACCOUNT_EXISTS\");\n  }", to: "if (byEmail) {\n    await prisma.oAuthAccount.create({\n      data: {\n        userId: byEmail.id,\n        provider: profile.provider,\n        providerUserId: profile.providerUserId,\n      },\n    });\n    return byEmail;\n  }" }],
  },
  {
    name: "le state OAuth redevient forgeable sans secret",
    file: "src/lib/oauth.ts",
    edits: [{ from: "if (!secret || secret.length < 16) {\n    throw new Error(\"OAUTH_STATE_SECRET_MISSING\");\n  }\n  return secret;", to: "return secret || \"cptcg-dev-oauth-state\";" }],
  },
  {
    name: "l'origine OAuth fait confiance à x-forwarded-host",
    file: "src/lib/oauth.ts",
    edits: [{ from: "if (process.env.TRUST_PROXY === \"1\") {\n    const forwardedHost = request.headers.get(\"x-forwarded-host\")?.split(\",\")[0]?.trim();\n    const forwardedProto = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n    if (forwardedHost) {\n      return `${forwardedProto === \"http\" ? \"http\" : \"https\"}://${forwardedHost}`;\n    }\n  }\n  return new URL(request.url).origin;", to: "const forwardedHost = request.headers.get(\"x-forwarded-host\")?.split(\",\")[0]?.trim();\n  const forwardedProto = request.headers.get(\"x-forwarded-proto\")?.split(\",\")[0]?.trim();\n  if (forwardedHost) {\n    return `${forwardedProto === \"http\" ? \"http\" : \"https\"}://${forwardedHost}`;\n  }\n  return new URL(request.url).origin;" }],
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

// Sous Windows (core.autocrlf), les sources sont extraites en CRLF : les extraits, écrits en LF, suivent
// la fin de ligne du fichier visé.
function withEol(source: string, text: string) {
  return source.includes("\r\n") ? text.replaceAll("\n", "\r\n") : text;
}

const originals = new Map<string, string>();
const mutated = new Map<(typeof mutations)[number], string>();
for (const mutation of mutations) {
  if (!originals.has(mutation.file)) originals.set(mutation.file, read(mutation.file));
  const source = originals.get(mutation.file) ?? "";
  let contents = source;
  for (const edit of mutation.edits) {
    const from = withEol(source, edit.from);
    if (!contents.includes(from)) {
      console.error(`extrait introuvable pour: ${mutation.name}`);
      process.exit(1);
    }
    contents = contents.replace(from, () => withEol(source, edit.to));
  }
  mutated.set(mutation, contents);
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
    write(mutation.file, mutated.get(mutation) ?? "");
    const result = runTests();
    restore();
    if (result.status === 0) {
      survived.push(mutation.name);
      console.log(`MANQUÉ: ${mutation.name}`);
    } else {
      // Premier test en échec : montre que la mutation casse une assertion, pas le chargement du module.
      const detail = `${result.stdout}\n${result.stderr}`
        .split(/\r?\n/)
        .find((line) => /^\s*FAIL\s.*>/.test(line))
        ?.replace(/^\s*FAIL\s+/, "");
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
