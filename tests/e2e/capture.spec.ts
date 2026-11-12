import { expectNoHorizontalScroll, settle, snap, test } from "./fixtures";

/**
 * Captures à la demande pour vérifier une page après une modification (ignoré sans CAPTURE_PATHS) :
 *   CAPTURE_PATHS="fr/collection,fr/decks" npx playwright test capture --project=desktop-chrome --project=pixel
 * Chemins sans « / » initial (Git Bash le transformerait en chemin Windows).
 * Résultat : tests/e2e/screenshots/<appareil>/capture_<chemin>.png. CAPTURE_SIGNED_OUT=1 pour un visiteur.
 */
const paths = (process.env.CAPTURE_PATHS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => value.replace(/^\/*/, "/"));

test.skip(paths.length === 0, "CAPTURE_PATHS absent");
test.use({ signedIn: process.env.CAPTURE_SIGNED_OUT !== "1" });

for (const target of paths) {
  test(`capture ${target}`, async ({ page, account }) => {
    void account;
    await page.goto(target);
    await settle(page);
    await expectNoHorizontalScroll(page);
    await snap(page, `capture${target.replace(/[^\w-]+/g, "_")}`);
  });
}
