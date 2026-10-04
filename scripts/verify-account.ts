import assert from "node:assert/strict";
import { POST as register } from "../src/app/api/auth/register/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as restoreSession } from "../src/app/api/auth/session/route";
import { POST as addBatch } from "../src/app/api/collection/bulk/route";
import { DELETE as removeLine, PATCH as patchLine } from "../src/app/api/collection/[id]/route";
import { GET as readCollection, POST as saveLine } from "../src/app/api/collection/route";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

type Line = {
  id: string;
  printingId: string;
  quantity: number;
  notes: string | null;
  purchasePrice: string | null;
  conditionCode: string;
};

const createdUserIds = new Set<string>();
const password = "motdepasse-robuste";

function originRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1${path}`, init);
}

function sessionToken(response: Response) {
  const lines = response.headers.getSetCookie();
  const line = lines.find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(line, `cookie de session absent: ${lines.join(" | ")}`);
  assert.match(line, /HttpOnly/i, "le cookie doit être inaccessible au script de la page");
  assert.match(line, /SameSite=Lax/i, "le cookie doit être renvoyé sur le même site");
  assert.match(line, new RegExp(`Max-Age=${SESSION_MAX_AGE_SECONDS}`, "i"), "la session téléphone doit durer 400 jours");
  assert.doesNotMatch(line, /;\s*Secure(?:;|$)/i, "un cookie Secure ne serait pas gardé en HTTP sur le téléphone");
  const raw = line.split(";")[0].slice(SESSION_COOKIE.length + 1);
  return decodeURIComponent(raw);
}

function authed(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return originRequest(path, { ...init, headers });
}

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`réponse non JSON ${response.status}: ${text.slice(0, 200)}`);
  }
}

async function linesOf(token: string) {
  const response = await readCollection(authed("/api/collection", token));
  assert.equal(response.status, 200, "la collection du compte doit se charger");
  const body = await json<{ items: Line[] }>(response);
  return body.items;
}

function line(items: Line[], printingId: string, conditionCode: string) {
  return items.find((item) => item.printingId === printingId && item.conditionCode === conditionCode);
}

async function main() {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `Compte.A.${stamp}@Example.com`;
  const emailB = `compte.b.${stamp}@example.com`;
  const emailVictim = `victime.${stamp}@example.com`;
  const printings = await prisma.printing.findMany({
    where: { isActive: true },
    select: { id: true },
    take: 3,
  });
  const conditions = await prisma.condition.findMany({ orderBy: { sortOrder: "asc" }, take: 2 });
  assert.equal(printings.length, 3, "catalogue de cartes indisponible");
  assert.equal(conditions.length, 2, "états de cartes indisponibles");
  const [first, second, third] = printings;
  const [nearMint, played] = conditions;

  const local = await prisma.user.create({ data: { displayName: "Téléphone" } });
  createdUserIds.add(local.id);
  await prisma.collectionItem.create({
    data: {
      userId: local.id,
      printingId: first.id,
      conditionId: nearMint.id,
      quantity: 2,
      notes: "depuis-le-telephone",
      purchasePrice: "3.50",
      purchaseCurrency: "EUR",
    },
  });

  const registered = await register(
    originRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: emailA,
        password,
        displayName: "Compte A",
        localUserId: local.id,
      }),
    }),
  );
  assert.equal(registered.status, 200, "création du compte");
  const accountA = await json<{ user: { id: string; email: string } }>(registered);
  createdUserIds.add(accountA.user.id);
  assert.notEqual(accountA.user.id, local.id, "un localUserId ne doit plus prendre le contrôle d'un orphelin");
  assert.equal(accountA.user.email, emailA.toLowerCase(), "l'e-mail est enregistré en minuscules");
  const tokenA = sessionToken(registered);

  assert.equal(
    line(await linesOf(tokenA), first.id, nearMint.code),
    undefined,
    "la collection orpheline ne fusionne plus à l'inscription",
  );
  assert.equal(
    await prisma.collectionItem.count({ where: { userId: local.id, printingId: first.id } }),
    1,
    "l'orphelin conserve ses cartes",
  );
  assert.ok(await prisma.user.findUnique({ where: { id: local.id } }), "l'utilisateur orphelin reste intact");

  const seedOwn = await saveLine(
    authed("/api/collection", tokenA, {
      method: "POST",
      body: JSON.stringify({
        printingId: first.id,
        conditionCode: nearMint.code,
        quantity: 2,
        mode: "set",
        notes: "depuis-le-telephone",
        purchasePrice: "3.50",
        purchaseCurrency: "EUR",
      }),
    }),
  );
  assert.equal(seedOwn.status, 200, "le compte peut enregistrer ses propres cartes");
  const seedOwnBody = await json<{ item: Line }>(seedOwn);
  const kept = seedOwnBody.item;
  assert.ok(kept?.id);

  const anonymous = await readCollection(originRequest("/api/collection"));
  assert.equal(anonymous.status, 401, "sans session, la collection est refusée");
  const headerOnly = await readCollection(
    originRequest("/api/collection", { headers: { "x-user-id": accountA.user.id } }),
  );
  assert.equal(headerOnly.status, 401, "l'identifiant envoyé par le navigateur ne doit pas ouvrir le compte");
  const forged = await readCollection(authed("/api/collection", "jeton-invente"));
  assert.equal(forged.status, 401, "un cookie inventé est refusé");

  const saved = await saveLine(
    authed("/api/collection", tokenA, {
      method: "POST",
      body: JSON.stringify({
        printingId: second.id,
        conditionCode: played.code,
        quantity: 4,
        mode: "set",
        notes: "boîte",
        purchasePrice: "12,50",
        purchaseCurrency: "EUR",
      }),
    }),
  );
  assert.equal(saved.status, 200, "enregistrement d'une ligne");
  const savedBody = await json<{ item: Line }>(saved);
  assert.equal(savedBody.item.quantity, 4);
  assert.equal(Number(savedBody.item.purchasePrice), 12.5);
  const stored = await prisma.collectionItem.findUnique({ where: { id: savedBody.item.id } });
  assert.equal(stored?.userId, accountA.user.id, "la ligne est écrite sur le compte connecté");

  const batched = await addBatch(
    authed("/api/collection/bulk", tokenA, {
      method: "POST",
      body: JSON.stringify({
        conditionCode: nearMint.code,
        lines: [{ printingId: third.id, quantity: 1 }],
      }),
    }),
  );
  assert.equal(batched.status, 200, "ajout groupé");
  const batchOwner = await prisma.collectionItem.findFirst({
    where: { userId: accountA.user.id, printingId: third.id, conditionId: nearMint.id },
  });
  assert.equal(batchOwner?.quantity, 1, "l'ajout groupé reste sur ce compte");

  const otherDevice = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailA.toUpperCase(), password }),
    }),
  );
  assert.equal(otherDevice.status, 200, "le même compte se rouvre avec l'e-mail, quelle que soit la casse");
  const tokenA2 = sessionToken(otherDevice);
  const restored = await linesOf(tokenA2);
  assert.equal(line(restored, first.id, nearMint.code)?.notes, "depuis-le-telephone");
  assert.equal(line(restored, second.id, played.code)?.quantity, 4);
  assert.equal(line(restored, third.id, nearMint.code)?.quantity, 1);

  const session = await restoreSession(authed("/api/auth/session", tokenA2));
  assert.equal(session.status, 200, "la session se prolonge à l'ouverture");
  const sessionBody = await json<{ user: { id: string } }>(session);
  assert.equal(sessionBody.user.id, accountA.user.id);

  await logout(authed("/api/auth/logout", tokenA, { method: "POST" }));
  const afterLogout = await readCollection(authed("/api/collection", tokenA));
  assert.equal(afterLogout.status, 401, "après déconnexion ce cookie n'ouvre plus le compte");
  assert.equal((await linesOf(tokenA2)).length, 3, "l'autre appareil reste connecté et garde les cartes");

  await prisma.session.updateMany({
    where: { userId: accountA.user.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const expired = await readCollection(authed("/api/collection", tokenA2));
  assert.equal(expired.status, 401, "une session périmée ne charge plus la collection");
  const relogin = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailA, password }),
    }),
  );
  assert.equal(relogin.status, 200, "une nouvelle connexion retrouve le compte");
  const tokenA3 = sessionToken(relogin);
  assert.equal(line(await linesOf(tokenA3), second.id, played.code)?.notes, "boîte");

  const registeredB = await register(
    originRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailB, password, displayName: "Compte B" }),
    }),
  );
  assert.equal(registeredB.status, 200, "second compte");
  const accountB = await json<{ user: { id: string } }>(registeredB);
  createdUserIds.add(accountB.user.id);
  const tokenB = sessionToken(registeredB);
  assert.equal((await linesOf(tokenB)).length, 0, "un autre compte démarre sans les cartes du premier");

  const stolenDelete = await removeLine(authed(`/api/collection/${savedBody.item.id}`, tokenB, { method: "DELETE" }), {
    params: Promise.resolve({ id: savedBody.item.id }),
  });
  assert.equal(stolenDelete.status, 200);
  const stolenDeleteBody = await json<{ deletedId: string | null }>(stolenDelete);
  assert.equal(stolenDeleteBody.deletedId, null, "un compte ne peut pas supprimer la ligne d'un autre");
  assert.equal(
    (await prisma.collectionItem.findUnique({ where: { id: savedBody.item.id } }))?.quantity,
    4,
  );

  const stolenPatch = await patchLine(
    authed(`/api/collection/${kept.id}`, tokenB, {
      method: "PATCH",
      body: JSON.stringify({ quantity: 99, notes: "piraté" }),
    }),
    { params: Promise.resolve({ id: kept.id }) },
  );
  assert.equal(stolenPatch.status, 400, "un compte ne peut pas modifier la ligne d'un autre");
  const untouched = await prisma.collectionItem.findUnique({ where: { id: kept.id } });
  assert.equal(untouched?.quantity, 2);
  assert.equal(untouched?.notes, "depuis-le-telephone");
  assert.equal(untouched?.userId, accountA.user.id);

  const separate = await saveLine(
    authed("/api/collection", tokenB, {
      method: "POST",
      body: JSON.stringify({
        printingId: first.id,
        conditionCode: nearMint.code,
        quantity: 7,
        mode: "set",
      }),
    }),
  );
  assert.equal(separate.status, 200);
  assert.equal(line(await linesOf(tokenA3), first.id, nearMint.code)?.quantity, 2, "la quantité de A ne change pas");
  assert.equal(line(await linesOf(tokenB), first.id, nearMint.code)?.quantity, 7, "B a sa propre quantité");

  const cleared = await saveLine(
    authed("/api/collection", tokenA3, {
      method: "POST",
      body: JSON.stringify({
        printingId: third.id,
        conditionCode: nearMint.code,
        quantity: 0,
        mode: "set",
      }),
    }),
  );
  assert.equal(cleared.status, 200, "mettre la quantité à zéro retire la ligne");
  assert.equal(line(await linesOf(tokenA3), third.id, nearMint.code), undefined);
  assert.equal(
    await prisma.collectionItem.count({ where: { userId: accountB.user.id, printingId: third.id } }),
    0,
  );

  const donor = await prisma.user.create({ data: { displayName: "Ancien téléphone" } });
  createdUserIds.add(donor.id);
  await prisma.collectionItem.create({
    data: { userId: donor.id, printingId: second.id, conditionId: played.id, quantity: 2 },
  });
  await prisma.collectionItem.create({
    data: {
      userId: accountB.user.id,
      printingId: second.id,
      conditionId: played.id,
      quantity: 1,
    },
  });
  const mergedLogin = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailB, password, localUserId: donor.id }),
    }),
  );
  assert.equal(mergedLogin.status, 200, "connexion accepte toujours localUserId mais l'ignore");
  const tokenB2 = sessionToken(mergedLogin);
  assert.equal(
    line(await linesOf(tokenB2), second.id, played.code)?.quantity,
    1,
    "la connexion ne fusionne plus une collection orpheline",
  );
  assert.ok(await prisma.user.findUnique({ where: { id: donor.id } }), "l'orphelin n'est pas absorbé");
  assert.equal(
    await prisma.collectionItem.count({ where: { userId: donor.id, printingId: second.id } }),
    1,
  );
  const mergedAgain = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailB, password, localUserId: donor.id }),
    }),
  );
  assert.equal(mergedAgain.status, 200);
  assert.equal(
    line(await linesOf(sessionToken(mergedAgain)), second.id, played.code)?.quantity,
    1,
    "répétition sans effet de bord",
  );

  const victim = await register(
    originRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailVictim, password, displayName: "Victime" }),
    }),
  );
  assert.equal(victim.status, 200);
  const accountVictim = await json<{ user: { id: string } }>(victim);
  createdUserIds.add(accountVictim.user.id);
  await prisma.collectionItem.create({
    data: {
      userId: accountVictim.user.id,
      printingId: third.id,
      conditionId: played.id,
      quantity: 5,
      notes: "privée",
    },
  });
  const attack = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailB, password, localUserId: accountVictim.user.id }),
    }),
  );
  assert.equal(attack.status, 200);
  const attackerLines = await linesOf(sessionToken(attack));
  assert.equal(line(attackerLines, third.id, played.code), undefined, "B ne récupère pas les cartes d'un autre compte");
  const victimRow = await prisma.collectionItem.findFirst({
    where: { userId: accountVictim.user.id, printingId: third.id },
  });
  assert.equal(victimRow?.quantity, 5);
  assert.equal(victimRow?.notes, "privée");
  assert.ok(await prisma.user.findUnique({ where: { id: accountVictim.user.id } }));

  const wrongPassword = await login(
    originRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailA, password: "mauvais-mot" }),
    }),
  );
  assert.equal(wrongPassword.status, 401, "un mauvais mot de passe n'ouvre pas la collection");
  const shortPassword = await register(
    originRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `court.${stamp}@example.com`, password: "court" }),
    }),
  );
  assert.equal(shortPassword.status, 400);
  const duplicate = await register(
    originRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailA.toLowerCase(), password }),
    }),
  );
  assert.equal(duplicate.status, 409, "le même e-mail ne crée pas un second compte vide");
  assert.equal(line(await linesOf(tokenA3), second.id, played.code)?.quantity, 4);

  console.log(JSON.stringify({ ok: true, accounts: createdUserIds.size }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const ids = [...createdUserIds];
    if (ids.length > 0) {
      await prisma.collectionItem.deleteMany({ where: { userId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });
