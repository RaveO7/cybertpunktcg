import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { clientErrorSchema } from "../../src/lib/api-schemas";
import { toReport } from "../../src/lib/client/error-reporting";
import { ancestry, hydrationDiff, hydrationReport, isHydrationError, type DomElement } from "../../src/lib/client/hydration-context";

function element(tagName: string, parentElement: DomElement | null, options: Partial<DomElement> = {}): DomElement {
  return { tagName, id: "", classList: [], outerHTML: `<${tagName.toLowerCase()}></${tagName.toLowerCase()}>`, parentElement, ...options };
}

describe("hydrationDiff", () => {
  // Page reconstruite par React : mêmes descriptions, objets différents.
  const page = () => {
    const body = element("BODY", null);
    const header = element("HEADER", body, { id: "top" });
    const main = element("MAIN", body, { classList: ["app-main", "flex"] });
    return { body, header, main };
  };

  it("donne le premier élément qui diffère, côté serveur et côté navigateur", () => {
    const server = page();
    const splash = element("DIV", server.main, { classList: ["splash"], outerHTML: '<div class="splash">…</div>' });
    const client = page();
    const grid = element("SECTION", client.main, { classList: ["grid"], outerHTML: '<section class="grid"></section>' });
    const text = hydrationDiff([server.header, server.main, splash], [client.header, client.main, grid]);
    assert.match(text, /serveur 3, maintenant 3/);
    assert.match(text, /écart à l'élément 2/);
    assert.match(text, /\[serveur\] body > main\.app-main\.flex > div\.splash\n<div class="splash">/);
    assert.match(text, /\[navigateur\] body > main\.app-main\.flex > section\.grid\n<section class="grid">/);
  });

  it("élément serveur en trop à la fin", () => {
    const server = page();
    const extra = element("ASIDE", server.main);
    const client = page();
    assert.match(hydrationDiff([server.header, server.main, extra], [client.header, client.main]), /\[navigateur\] \(aucun\)/);
  });

  it("rapport : contenu du corps dans l'ordre, puis balises disparues ou apparues (corps technique et tête)", () => {
    const server = page();
    const client = page();
    const script = element("SCRIPT", client.body, { outerHTML: '<script src="/a.js"></script>' });
    const css = '<link rel="stylesheet" href="/a.css">';
    const meta = '<meta name="theme-color" content="#000">';
    const text = hydrationReport(
      { head: [element("META", null, { outerHTML: meta }), element("LINK", null, { outerHTML: css })], body: [server.header, server.main] },
      // Tête réordonnée par React : la feuille de style en premier, sans écart à signaler pour elle.
      { head: [element("LINK", null, { outerHTML: css }), element("TITLE", null)], body: [script, client.header, client.main] },
    );
    const [content, technical, head] = text.split(/\n(?=\[(?:corps|tête))/);
    assert.match(content, /^\[corps, contenu\] .*\naucun écart de structure/);
    assert.equal(technical, '[corps, balises techniques] disparues :\n(aucune)\napparues :\n<script src="/a.js"></script>');
    assert.equal(head, `[tête] disparues :\n${meta}\napparues :\n<title></title>`);
  });

  it("même structure : le dit", () => {
    const server = page();
    const client = page();
    assert.match(hydrationDiff([server.header, server.main], [client.header, client.main]), /aucun écart de structure/);
  });

  it("chemin d'un élément", () => {
    assert.equal(ancestry(page().header), "body > header#top");
  });
});

describe("rapport d'une erreur d'hydratation", () => {
  it("reconnaît les erreurs d'hydratation", () => {
    assert.ok(isHydrationError("Minified React error #418; visit https://react.dev/errors/418"));
    assert.ok(isHydrationError("Hydration failed because the server rendered HTML didn't match the client."));
    assert.ok(!isHydrationError("Minified React error #310"));
  });

  it("joint le contexte après la pile, dans la limite de l'API", () => {
    const origin = "https://cybertpunktcg.vercel.app";
    const error = new Error("Minified React error #418");
    error.stack = `Error: x\n${`    at ${origin}/_next/static/chunks/a.js:1:2\n`.repeat(200)}`;
    const report = toReport(error, origin, { pathname: "/fr/cards", serviceWorker: false }, "écart à l'élément 3 ".repeat(300));
    assert.ok(report?.stack);
    assert.match(report.stack, /--- contexte ---\nécart à l'élément 3/);
    assert.ok(clientErrorSchema.safeParse(report).success);
  });
});
