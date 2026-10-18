import type { Page } from "@playwright/test";
import { expect, snap, test } from "./fixtures";

const touch = { pointerType: "touch", isPrimary: true, pointerId: 1, bubbles: true };

async function openTutorialHand(page: Page) {
  await page.goto("/fr/comment-jouer");
  await page.getByRole("button", { name: "Parcours débutant" }).click();
  const card = page.locator('button[data-coach-id^="coach-hand-"]').first();
  await expect(card).toBeVisible();
  return card;
}

/** La carte soulevée est affichée, entière à l'écran, et aucun ancêtre ne la rogne. */
async function expectLiftedCardUnclipped(page: Page) {
  const lift = page.locator(".dm-lift");
  await expect(lift).toBeVisible();
  await lift.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));

  const box = await lift.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 0.5);

  // Non rognée par le plateau : aucun ancêtre ne coupe ce qui dépasse.
  const clippedBy = await lift.evaluate((el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") return node.className || node.tagName;
    }
    return null;
  });
  expect(clippedBy).toBeNull();
  return lift;
}

test("appui long sur une carte de la main : carte soulevée entière à l'écran", async ({ page, account, isMobile }) => {
  void account;
  test.skip(!isMobile, "appui long au doigt : téléphone seulement");
  const card = await openTutorialHand(page);

  // Pas d'API d'appui long dans Playwright : doigt posé 500 ms (seuil de l'app : 400 ms).
  await card.dispatchEvent("pointerdown", touch);
  await page.waitForTimeout(500);
  const lift = await expectLiftedCardUnclipped(page);
  await snap(page, "tutoriel-carte-soulevee");

  await card.dispatchEvent("pointerup", touch);
  await expect(lift).toHaveCount(0);
});

test("survol à la souris d'une carte de la main : carte soulevée entière à l'écran", async ({ page, account, isMobile }) => {
  void account;
  test.skip(isMobile, "survol à la souris : ordinateur seulement");
  const card = await openTutorialHand(page);

  await card.hover();
  const lift = await expectLiftedCardUnclipped(page);
  await snap(page, "tutoriel-carte-survolee");

  await page.mouse.move(0, 0);
  await expect(lift).toHaveCount(0);
});
