import { prisma } from "../src/lib/prisma";

const base = "http://localhost:3000";
const email = "verify-http@example.com";
const password = "verify-password";

function rememberCookies(response: Response, jar: Map<string, string>) {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function main() {
  const jar = new Map<string, string>();
  const anonymous = await fetch(`${base}/api/catalog`, { headers: { "x-user-id": "apitestuser1" } });
  if (anonymous.status !== 401) throw new Error("header auth still accepted");

  let authResponse = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Vérification" }),
  });
  if (authResponse.status === 409) {
    authResponse = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }
  if (!authResponse.ok) throw new Error(`auth ${authResponse.status}`);
  const sessionCookie = authResponse.headers.getSetCookie().find((line) => line.startsWith("cptcg_session="));
  if (!sessionCookie) throw new Error("missing session cookie");
  if (!/HttpOnly/i.test(sessionCookie)) throw new Error("cookie not httpOnly");
  if (!/SameSite=Lax/i.test(sessionCookie)) throw new Error("cookie not lax");
  if (!/max-age=34560000/i.test(sessionCookie)) throw new Error(`cookie not persistent: ${sessionCookie}`);
  rememberCookies(authResponse, jar);
  const headers = { "content-type": "application/json", cookie: cookieHeader(jar) };

  const sessionResponse = await fetch(`${base}/api/auth/session`, { headers });
  const session = (await sessionResponse.json()) as { user?: { email: string } };
  if (!sessionResponse.ok || session.user?.email !== email) throw new Error("session restore");
  rememberCookies(sessionResponse, jar);

  const catalogResponse = await fetch(`${base}/api/catalog`, { headers });
  const catalog = (await catalogResponse.json()) as {
    cards: { canonicalName: string; color: string | null; tags: string[] }[];
    printings: { id: string; collectorNumber: string; setCode: string; language: string; imagePath: string | null; rarity: string | null; marketPrice: string | null }[];
    sets: { code: string; name: string }[];
    hasPrices: boolean;
  };
  if (!catalogResponse.ok) throw new Error("catalog");
  if (!catalog.hasPrices && catalog.printings.some((item) => item.marketPrice)) throw new Error("unexpected price");
  if (catalog.hasPrices && !catalog.printings.some((item) => item.marketPrice)) throw new Error("missing market price");
  if (!catalog.sets.some((set) => set.code === "welcometonightcityretail")) throw new Error("missing retail set");
  const street = catalog.cards.find((card) => card.canonicalName.includes("Streetkid"));
  if (!street) throw new Error("missing V");
  const printing = catalog.printings.find(
    (item) => item.setCode === "welcometonightcityretail" && item.language === "en" && item.collectorNumber === "005a",
  );
  if (!printing?.imagePath) throw new Error("missing printing image");

  const image = await fetch(`${base}${printing.imagePath}`);
  if (!image.ok || !(image.headers.get("content-type") ?? "").includes("image")) {
    throw new Error(`image ${image.status}`);
  }

  const created = await fetch(`${base}/api/collection`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      printingId: printing.id,
      conditionCode: "NM",
      quantity: 3,
      mode: "set",
    }),
  });
  const createdBody = (await created.json()) as { item?: { quantity: number }; error?: string };
  if (!created.ok || createdBody.item?.quantity !== 3) throw new Error(createdBody.error ?? "create failed");

  const played = await fetch(`${base}/api/collection`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      printingId: printing.id,
      conditionCode: "LP",
      quantity: 1,
      mode: "add",
    }),
  });
  if (!played.ok) throw new Error("second line failed");

  const statsResponse = await fetch(`${base}/api/stats?scope=en`, { headers });
  const stats = (await statsResponse.json()) as {
    progress: { uniqueOwned: number; totalCopies: number; duplicates: number; total: number };
    hasPrices: boolean;
  };
  if (stats.progress.uniqueOwned !== 1) throw new Error(`unique ${stats.progress.uniqueOwned}`);
  if (stats.progress.totalCopies !== 4) throw new Error(`copies ${stats.progress.totalCopies}`);
  if (stats.progress.duplicates !== 1) throw new Error("duplicates");
  if (stats.progress.total < 140) throw new Error("main total");

  const home = await fetch(`${base}/`);
  const cards = await fetch(`${base}/cards`);
  const homeText = await home.text();
  const cardsText = await cards.text();
  if (!home.ok || !cards.ok) throw new Error("pages");
  if (!homeText.includes("Tableau de bord") || !homeText.includes("Chargement de la collection")) {
    throw new Error("home html");
  }
  if (!cardsText.includes("Chargement des cartes")) throw new Error("cards html");

  const collection = (await (await fetch(`${base}/api/collection`, { headers })).json()) as {
    items: { id: string }[];
  };
  for (const item of collection.items) {
    const removed = await fetch(`${base}/api/collection/${item.id}`, { method: "DELETE", headers });
    if (!removed.ok) throw new Error("delete");
  }
  const after = (await (await fetch(`${base}/api/stats?scope=en`, { headers })).json()) as {
    progress: { uniqueOwned: number; totalCopies: number };
  };
  if (after.progress.uniqueOwned !== 0 || after.progress.totalCopies !== 0) throw new Error("not reset");

  const loggedOut = await fetch(`${base}/api/auth/logout`, { method: "POST", headers });
  if (!loggedOut.ok) throw new Error("logout");
  const ended = await fetch(`${base}/api/auth/session`, { headers });
  if (ended.status !== 401) throw new Error("session still active");
  const rejected = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "mauvaisxx" }),
  });
  if (rejected.status !== 401) throw new Error("bad password accepted");

  console.log(
    JSON.stringify({
      ok: true,
      cards: catalog.cards.length,
      printings: catalog.printings.length,
      retailTotal: stats.progress.total,
      image: printing.imagePath,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Le compte de test et ses données (cascade) ne doivent pas rester en base.
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
