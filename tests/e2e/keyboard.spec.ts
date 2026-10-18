import { prisma } from "@/lib/prisma";
import { expect, settle, test } from "./fixtures";

// Champ texte focalisé (clavier ouvert, barre du bas masquée) puis tap direct sur le bouton d'envoi.
test("tap sur Créer juste après avoir saisi le nom du tournoi", async ({ page, account }) => {
  await page.goto("/fr/tournois");
  await settle(page);
  await expect(page.getByText("Chargement…")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nom du tournoi" }).tap();
  await page.getByRole("textbox", { name: "Nom du tournoi" }).fill("Clavier E2E");
  const btn = page.getByRole("button", { name: "Créer", exact: true });
  await btn.scrollIntoViewIfNeeded();
  const nav = await page.getByRole("navigation", { name: "Sections" }).count();
  console.log(test.info().project.name, "barre du bas visible pendant la saisie :", nav > 0);
  try {
    await btn.tap();
    await expect(page).toHaveURL(/\/tournois\/c/, { timeout: 8000 });
  } finally {
    await prisma.tournament.deleteMany({ where: { organizers: { some: { userId: account.id } } } });
  }
});
