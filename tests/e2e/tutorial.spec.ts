import { expect, snap, test } from "./fixtures";

const touch = { pointerType: "touch", isPrimary: true, pointerId: 1, bubbles: true };

test("appui long sur une carte de la main : carte soulevée entière à l'écran", async ({ page, account }) => {
  void account;
  await page.goto("/fr/comment-jouer");
  await page.getByRole("button", { name: "Parcours débutant" }).click();
  const card = page.locator('button[data-coach-id^="coach-hand-"]').first();
  await expect(card).toBeVisible();

  // Pas d'API d'appui long dans Playwright : doigt posé 500 ms (seuil de l'app : 400 ms).
  await card.dispatchEvent("pointerdown", touch);
  await page.waitForTimeout(500);
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
  await snap(page, "tutoriel-carte-soulevee");

  await card.dispatchEvent("pointerup", touch);
  await expect(lift).toHaveCount(0);
});
