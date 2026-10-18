import type { Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { expect, settle, snap, test } from "./fixtures";

/**
 * Balayage de toutes les pages sur téléphone et sur ordinateur : erreurs JS, requêtes en échec, débordement horizontal.
 * Les pages dynamiques sans données (boutique, tournoi, classeur) sont visitées avec un identifiant
 * inconnu : elles doivent afficher un « introuvable » propre, pas planter.
 */

type Problem = string;

function watch(page: Page) {
  const problems: Problem[] = [];
  page.on("pageerror", (err) => {
    // WebKit (Safari iOS et desktop) signale ainsi les préchargements annulés par la navigation suivante (déjà gérés par l'app).
    if (/due to access control checks/.test(err.message)) return;
    problems.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // 404 des identifiants inconnus, 401 de la session en visiteur, 403 de l'admin pour un non-admin.
    if (/Failed to load resource: the server responded with a status of (401|403|404)/.test(text)) return;
    // WebKit ne connaît pas `interactive-widget` (meta viewport), ignoré sans conséquence.
    if (/interactive-widget/.test(text)) return;
    problems.push(`console: ${text.slice(0, 300)}`);
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 500) problems.push(`HTTP ${status} ${res.url()}`);
  });
  page.on("requestfailed", (req) => {
    const err = req.failure()?.errorText ?? "";
    // Navigations abandonnées et préchargements annulés : bruit normal.
    if (/ERR_ABORTED|cancelled|NS_BINDING_ABORTED|Load request cancelled/i.test(err)) return;
    problems.push(`requestfailed: ${req.url()} ${err}`);
  });
  return problems;
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= vw) return null;
    // Éléments qui dépassent à droite, pour le diagnostic.
    const culprits = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return `scrollWidth ${sw} > ${vw} : ${culprits.join(" | ")}`;
  });
}

async function visit(page: Page, path: string, name: string) {
  const problems = watch(page);
  const res = await page.goto(path);
  await settle(page);
  await page.waitForTimeout(500);
  const status = res?.status() ?? 0;
  const of = await overflow(page);
  await snap(page, name);
  return { path, status, problems: [...problems, ...(of ? [`overflow: ${of}`] : [])] };
}

async function cardSlug() {
  const card = await prisma.card.findFirst({ where: { slug: { not: "" } }, select: { slug: true } });
  return card?.slug ?? "inconnue";
}

const PUBLIC = [
  ["/fr", "accueil"],
  ["/fr/cartes", "catalogue"],
  ["/fr/comment-jouer", "comment-jouer"],
  ["/fr/boutiques", "boutiques"],
  ["/fr/tournois/publics", "tournois-publics"],
  ["/fr/connexion", "connexion"],
  ["/fr/cgu", "cgu"],
  ["/fr/confidentialite", "confidentialite"],
  ["/fr/mentions-legales", "mentions-legales"],
  ["/en", "accueil-en"],
  ["/fr/boutiques/inconnue-e2e", "boutique-inconnue"],
  ["/fr/tournois/publics/inconnu-e2e", "tournoi-public-inconnu"],
  ["/fr/classeur/inconnu-e2e", "classeur-inconnu"],
  ["/fr/t/ZZZZZZ", "code-tournoi-inconnu"],
] as const;

const PRIVATE = [
  ["/fr", "tableau-de-bord"],
  ["/fr/cards", "collection"],
  ["/fr/decks", "decks"],
  ["/fr/souhaits", "souhaits"],
  ["/fr/investissement", "investissement"],
  ["/fr/parametres", "parametres"],
  ["/fr/tournois", "tournois"],
  ["/fr/compte/boutique", "ma-boutique"],
  ["/fr/admin/boutiques", "admin-boutiques"],
  ["/fr/tournois/inconnu-e2e", "tournoi-inconnu"],
  ["/fr/tournois/invitation/inconnu-e2e", "invitation-inconnue"],
  ["/fr/t/claim/inconnu-e2e", "claim-inconnu"],
] as const;

function report(results: Awaited<ReturnType<typeof visit>>[]) {
  const bad = results.filter((r) => r.problems.length || r.status >= 500);
  for (const r of results) console.log(`${r.status} ${r.path}${r.problems.length ? " ⚠ " + r.problems.length : ""}`);
  for (const r of bad) console.log(`\n✗ ${r.path} (${r.status})\n  - ${r.problems.join("\n  - ")}`);
  return bad;
}

test.describe("anonyme", () => {
  test.use({ signedIn: false });
  test("toutes les pages publiques", async ({ page, account }) => {
    void account;
    const results = [];
    for (const [path, name] of PUBLIC) results.push(await visit(page, path, `anon-${name}`));
    results.push(await visit(page, `/fr/cartes/${await cardSlug()}`, "anon-fiche-carte"));
    // Pages privées sans session : doivent renvoyer vers la connexion ou l'accueil, sans erreur.
    for (const [path, name] of PRIVATE.slice(1, 8)) results.push(await visit(page, path, `anon-prive-${name}`));
    expect(report(results).map((r) => r.path)).toEqual([]);
  });
});

test("toutes les pages connecté", async ({ page, account }) => {
  void account;
  const results = [];
  for (const [path, name] of PRIVATE) results.push(await visit(page, path, `user-${name}`));
  results.push(await visit(page, `/fr/cartes/${await cardSlug()}`, "user-fiche-carte"));
  results.push(await visit(page, "/fr/boutiques", "user-boutiques"));
  results.push(await visit(page, "/fr/tournois/publics", "user-tournois-publics"));
  results.push(await visit(page, "/fr/comment-jouer", "user-comment-jouer"));
  expect(report(results).map((r) => r.path)).toEqual([]);
});
