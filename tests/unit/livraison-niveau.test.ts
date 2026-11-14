import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { classer, correspond } from "../../scripts/livraison-niveau.mjs";

describe("niveau de livraison", () => {
  it("ne construit rien pour des mesures, docs, tests ou outils", () => {
    assert.equal(classer(["docs/perf/history/2026-11-13-21-50-43.json"]), "aucun");
    assert.equal(classer(["tests/e2e/layout-shift.spec.ts", "CLAUDE.md", ".claude/hooks/verify-on-stop.mjs"]), "aucun");
    assert.equal(classer(["scripts/verify.mjs", "scripts/perf/report.ts"]), "aucun");
  });

  it("garde le build pour les scripts lancés par le build", () => {
    assert.equal(correspond("scripts/generate-thumbnails.ts", ["scripts/**", "!scripts/generate-thumbnails.ts"]), false);
    assert.equal(classer(["scripts/generate-thumbnails.ts"]), "leger");
    assert.equal(classer(["scripts/vercel-db-push.mjs"]), "complet");
  });

  it("passe en léger pour du code de l'app sans risque de données", () => {
    assert.equal(classer(["src/components/AppFrame.tsx", "tests/e2e/layout-shift.spec.ts"]), "leger");
    assert.equal(classer(["src/lib/card-image.ts"]), "leger");
  });

  it("exige la preview pour schéma, API, authentification, dépendances et fonctionnalités", () => {
    assert.equal(classer(["prisma/schema.prisma"]), "complet");
    assert.equal(classer(["src/app/api/collection/route.ts"]), "complet");
    assert.equal(classer(["src/lib/tournament/repository.ts"]), "complet");
    assert.equal(classer(["src/app/[locale]/decks/actions.ts"]), "complet");
    assert.equal(classer(["package-lock.json"]), "complet");
    assert.equal(classer(["src/components/AppFrame.tsx"], ["feat/nouvelle-page"]), "complet");
  });

  it("ne confond pas un fichier de même nom ailleurs", () => {
    assert.equal(correspond("src/lib/tournament/service.ts", ["src/lib/**/service.ts"]), true);
    assert.equal(correspond("src/lib/auth.ts.bak", ["src/lib/auth.ts"]), false);
    assert.equal(correspond("src/README.md", ["**/*.md"]), true);
  });
});
