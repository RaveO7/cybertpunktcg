/**
 * Couleur des barres du navigateur (`theme-color`) accordée au thème de l'app.
 * Cf. specs/site/theme.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { THEME_CHROME_COLORS, applyTheme, syncThemeColorMeta } from "../../src/lib/preferences";

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "", className: "" });
  return { Geist: font, Geist_Mono: font, Chakra_Petch: font };
});
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));

/** Juste ce qu'il faut de DOM pour les balises `<meta>` du `<head>`. */
class FakeElement {
  attrs = new Map<string, string>();
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  constructor(readonly tagName: string) {}
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  appendChild(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((el) => el !== this);
    this.parent = null;
  }
}

function fakeDocument(metas: Record<string, string>[] = []) {
  const head = new FakeElement("head");
  for (const attrs of metas) {
    const meta = new FakeElement("meta");
    for (const [k, v] of Object.entries(attrs)) meta.setAttribute(k, v);
    head.appendChild(meta);
  }
  const doc = {
    head,
    documentElement: new FakeElement("html"),
    createElement: (tag: string) => new FakeElement(tag),
    querySelectorAll: (selector: string) => {
      assert.equal(selector, 'meta[name="theme-color"]');
      return head.children.filter((el) => el.tagName === "meta" && el.getAttribute("name") === "theme-color");
    },
  };
  return doc;
}

function themeMetas(doc: ReturnType<typeof fakeDocument>) {
  return doc.querySelectorAll('meta[name="theme-color"]');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncThemeColorMeta", () => {
  it("crée la balise si elle est absente", () => {
    const doc = fakeDocument();
    syncThemeColorMeta(doc as unknown as Document, "dark");
    const metas = themeMetas(doc);
    assert.equal(metas.length, 1);
    assert.equal(metas[0].getAttribute("content"), "#07080d");
    assert.equal(metas[0].hasAttribute("media"), false);
  });

  it("supprime les doublons et les variantes media", () => {
    const doc = fakeDocument([
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#e8eef6" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#07080d" },
      { name: "theme-color", content: "#07080d" },
      { name: "theme-color", content: "#ffffff" },
      { name: "description", content: "autre" },
    ]);
    syncThemeColorMeta(doc as unknown as Document, "light");
    const metas = themeMetas(doc);
    assert.equal(metas.length, 1);
    assert.equal(metas[0].hasAttribute("media"), false);
    assert.equal(metas[0].getAttribute("content"), "#e8eef6");
    assert.equal(doc.head.children.length, 2, "les autres balises sont conservées");
  });

  it("ne garde qu'une balise même s'il n'y avait que des variantes media", () => {
    const doc = fakeDocument([
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#e8eef6" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#07080d" },
    ]);
    syncThemeColorMeta(doc as unknown as Document, "dark");
    const metas = themeMetas(doc);
    assert.equal(metas.length, 1);
    assert.equal(metas[0].hasAttribute("media"), false);
    assert.equal(metas[0].getAttribute("content"), THEME_CHROME_COLORS.dark);
  });

  it("couleurs sombre et claire", () => {
    assert.deepEqual(THEME_CHROME_COLORS, { dark: "#07080d", light: "#e8eef6" });
  });
});

describe("applyTheme", () => {
  it("fait suivre la couleur des barres au thème", () => {
    const doc = fakeDocument([{ name: "theme-color", content: "#07080d" }]);
    vi.stubGlobal("document", doc);

    applyTheme("light");
    assert.equal(doc.documentElement.getAttribute("data-theme"), "light");
    assert.equal(themeMetas(doc).length, 1);
    assert.equal(themeMetas(doc)[0].getAttribute("content"), "#e8eef6");

    applyTheme("dark");
    assert.equal(doc.documentElement.getAttribute("data-theme"), "dark");
    assert.equal(themeMetas(doc).length, 1);
    assert.equal(themeMetas(doc)[0].getAttribute("content"), "#07080d");
  });
});

describe("siteViewport", () => {
  it("annonce une seule couleur sombre, sans variante prefers-color-scheme", async () => {
    const { siteViewport } = await import("../../src/components/site/SiteShell");
    assert.equal(siteViewport.themeColor, "#07080d");
  });
});
