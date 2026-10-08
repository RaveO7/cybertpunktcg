import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  bulkSchema,
  loginSchema,
  patchLineSchema,
  quantitySchema,
  readJsonBody,
  registerSchema,
  saveLineSchema,
  shareSchema,
  shareTokenSchema,
  validate,
} from "../../src/lib/api-schemas";

type Schema = Parameters<typeof validate>[0];

/** Valide et renvoie les données, ou échoue le test avec le message d'erreur. */
async function ok(schema: Schema, value: unknown) {
  const result = validate(schema, value);
  if (!result.ok) assert.fail(`refusé : ${JSON.stringify(await result.response.json())}`);
  return result.data as Record<string, unknown>;
}

/** Valide en s'attendant à un refus ; renvoie le statut et le message. */
async function ko(schema: Schema, value: unknown, status?: number) {
  const result = validate(schema, value, status);
  assert.equal(result.ok, false, `accepté à tort : ${JSON.stringify(value)}`);
  if (result.ok) throw new Error("inatteignable");
  const body = (await result.response.json()) as { error: string };
  return { status: result.response.status, error: body.error };
}

const line = (partial: Record<string, unknown>) => ({ printingId: "p1", quantity: 1, ...partial });

describe("quantitySchema", () => {
  it("accepte les entiers 0..999 et les chaînes numériques", () => {
    assert.equal(quantitySchema.parse(0), 0);
    assert.equal(quantitySchema.parse(999), 999);
    assert.equal(quantitySchema.parse("3"), 3);
    assert.equal(quantitySchema.parse(" 12 "), 12);
  });

  it("refuse négatifs, décimaux, trop grands, vides et non numériques", () => {
    for (const value of [-1, 1000, 1.5, "2.5", "", "   ", "abc", null, undefined, true, Number.NaN, Infinity, [], {}]) {
      assert.equal(quantitySchema.safeParse(value).success, false, `devrait refuser ${String(value)}`);
    }
  });

  it("les erreurs de quantité ont un message dédié", async () => {
    for (const quantity of [-1, 1000, 1.5, "abc"]) {
      const { error } = await ko(saveLineSchema, line({ quantity }));
      assert.equal(error, "Quantité invalide.");
    }
  });
});

describe("saveLineSchema", () => {
  it("applique les valeurs par défaut (état NM, mode add) et retire les champs inconnus", async () => {
    const data = await ok(saveLineSchema, { printingId: " p1 ", quantity: "2", userId: "autre-compte", id: "x" });
    assert.equal(data.printingId, "p1");
    assert.equal(data.conditionCode, "NM");
    assert.equal(data.mode, "add");
    assert.equal(data.quantity, 2);
    // Un champ inconnu (ex. userId d'un autre compte) ne doit jamais traverser la validation.
    assert.equal("userId" in data, false);
    assert.equal("id" in data, false);
    // Rien n'est fourni pour prix / devise / notes : ils restent absents (pas d'écrasement en base).
    assert.equal(data.purchasePrice, undefined);
    assert.equal(data.purchaseCurrency, undefined);
    assert.equal(data.notes, undefined);
  });

  it("refuse un identifiant vide, blanc ou trop long et un état trop long", async () => {
    for (const printingId of ["", "   ", "x".repeat(129), 42, null]) {
      assert.equal((await ko(saveLineSchema, line({ printingId }))).error, "Requête invalide.");
    }
    assert.equal((await ok(saveLineSchema, line({ printingId: "x".repeat(128) }))).printingId, "x".repeat(128));
    await ko(saveLineSchema, line({ conditionCode: "" }));
    await ko(saveLineSchema, line({ conditionCode: "X".repeat(17) }));
    assert.equal((await ok(saveLineSchema, line({ conditionCode: " LP " }))).conditionCode, "LP");
  });

  it("refuse un mode inconnu", async () => {
    await ko(saveLineSchema, line({ mode: "replace" }));
    assert.equal((await ok(saveLineSchema, line({ mode: "set" }))).mode, "set");
  });

  it("normalise le prix : virgule, point, nombre, 2 décimales", async () => {
    const cases: [unknown, string][] = [
      ["12,50", "12.50"],
      ["12.50", "12.50"],
      [" 12,5 ", "12.50"],
      [12.5, "12.50"],
      [0, "0.00"],
      ["0", "0.00"],
      [1_000_000, "1000000.00"],
      [3, "3.00"],
    ];
    for (const [input, expected] of cases) {
      const data = await ok(saveLineSchema, line({ purchasePrice: input }));
      assert.equal(data.purchasePrice, expected, `prix ${JSON.stringify(input)}`);
    }
  });

  it("efface le prix avec \"\" ou null, et la devise avec lui", async () => {
    for (const purchasePrice of ["", null]) {
      const data = await ok(saveLineSchema, line({ purchasePrice, purchaseCurrency: "USD" }));
      assert.equal(data.purchasePrice, null);
      assert.equal(data.purchaseCurrency, null);
    }
  });

  it("refuse les prix négatifs, énormes ou illisibles", async () => {
    for (const purchasePrice of [-0.01, "-1", 1_000_000.01, "abc", "12,50,3", "1 000,50", Infinity, "Infinity", true, {}]) {
      const { error } = await ko(saveLineSchema, line({ purchasePrice }));
      assert.equal(error, "Prix invalide.", `prix ${JSON.stringify(purchasePrice)}`);
    }
  });

  // Attendu : une saisie composée d'espaces vaut une saisie vide (prix effacé) ou est refusée.
  // Observé : " ".trim() → "" puis Number("") → 0 : un prix d'achat de 0,00 € est enregistré.
  it("un prix composé uniquement d'espaces efface le prix au lieu d'enregistrer 0,00 €", async () => {
    const result = validate(saveLineSchema, line({ purchasePrice: "   " }));
    if (result.ok) assert.notEqual((result.data as Record<string, unknown>).purchasePrice, "0.00");
  });

  it("devise : EUR par défaut avec un prix, conservée sinon, refusée si inconnue", async () => {
    assert.equal((await ok(saveLineSchema, line({ purchasePrice: "5" }))).purchaseCurrency, "EUR");
    assert.equal((await ok(saveLineSchema, line({ purchasePrice: "5", purchaseCurrency: null }))).purchaseCurrency, "EUR");
    assert.equal((await ok(saveLineSchema, line({ purchasePrice: "5", purchaseCurrency: "GBP" }))).purchaseCurrency, "GBP");
    // Un prix de 0 reste un prix : devise EUR (la chaîne "0.00" n'est pas falsy).
    assert.equal((await ok(saveLineSchema, line({ purchasePrice: 0 }))).purchaseCurrency, "EUR");
    for (const purchaseCurrency of ["eur", "JPY", "", 1]) {
      const { error } = await ko(saveLineSchema, line({ purchasePrice: "5", purchaseCurrency }));
      assert.equal(error, "Devise invalide.");
    }
  });

  it("notes : rognées, vides → null, tronquées à 2000 caractères, type vérifié", async () => {
    assert.equal((await ok(saveLineSchema, line({ notes: "  hello  " }))).notes, "hello");
    assert.equal((await ok(saveLineSchema, line({ notes: "   " }))).notes, null);
    assert.equal((await ok(saveLineSchema, line({ notes: null }))).notes, null);
    const long = await ok(saveLineSchema, line({ notes: ` ${"é".repeat(2500)} ` }));
    assert.equal((long.notes as string).length, 2000);
    assert.equal((await ko(saveLineSchema, line({ notes: 12 }))).error, "Notes invalides.");
  });

  it("refuse un corps qui n'est pas un objet", async () => {
    for (const body of [null, undefined, "x", 1, []]) {
      assert.equal((await ko(saveLineSchema, body)).error, "Requête invalide.");
    }
  });
});

describe("patchLineSchema", () => {
  it("un corps vide ne touche à rien", async () => {
    const data = await ok(patchLineSchema, {});
    assert.equal(data.quantity, undefined);
    assert.equal(data.conditionCode, undefined);
    assert.equal(data.purchasePrice, undefined);
    assert.equal(data.purchaseCurrency, undefined);
    assert.equal(data.notes, undefined);
  });

  it("changer la devise seule ne fabrique pas de prix", async () => {
    const data = await ok(patchLineSchema, { purchaseCurrency: "USD" });
    assert.equal(data.purchaseCurrency, "USD");
    assert.equal(data.purchasePrice, undefined);
  });

  it("effacer le prix efface aussi la devise", async () => {
    const data = await ok(patchLineSchema, { purchasePrice: null, purchaseCurrency: "GBP" });
    assert.equal(data.purchasePrice, null);
    assert.equal(data.purchaseCurrency, null);
  });

  it("valide la quantité et l'état", async () => {
    assert.equal((await ok(patchLineSchema, { quantity: "0" })).quantity, 0);
    assert.equal((await ko(patchLineSchema, { quantity: -2 })).error, "Quantité invalide.");
    await ko(patchLineSchema, { conditionCode: "   " });
  });
});

describe("bulkSchema", () => {
  it("ignore les lignes à 0 et garde les autres", async () => {
    const data = await ok(bulkSchema, {
      lines: [
        { printingId: "a", quantity: 0 },
        { printingId: "b", quantity: "2" },
      ],
    });
    assert.equal(data.conditionCode, "NM");
    assert.deepEqual(data.lines, [{ printingId: "b", quantity: 2 }]);
  });

  it("refuse une liste vide ou entièrement à 0", async () => {
    assert.equal((await ko(bulkSchema, { lines: [] })).error, "Aucune carte à ajouter.");
    assert.equal((await ko(bulkSchema, { lines: [{ printingId: "a", quantity: 0 }] })).error, "Aucune carte à ajouter.");
  });

  it("plafonne à 400 lignes (avant filtrage des zéros)", async () => {
    const lines = (n: number, quantity = 1) => Array.from({ length: n }, (_, i) => ({ printingId: `p${i}`, quantity }));
    assert.equal(((await ok(bulkSchema, { lines: lines(400) })).lines as unknown[]).length, 400);
    assert.equal((await ko(bulkSchema, { lines: lines(401) })).error, "Trop de cartes d'un coup.");
    assert.equal((await ko(bulkSchema, { lines: lines(401, 0) })).error, "Trop de cartes d'un coup.");
  });

  it("refuse une ligne invalide parmi d'autres", async () => {
    assert.equal(
      (await ko(bulkSchema, { lines: [{ printingId: "a", quantity: 1 }, { printingId: "b", quantity: -1 }] })).error,
      "Quantité invalide.",
    );
    await ko(bulkSchema, { lines: [{ printingId: "", quantity: 1 }] });
    await ko(bulkSchema, { lines: "a" });
    await ko(bulkSchema, {});
  });
});

describe("loginSchema / registerSchema", () => {
  it("normalise l'e-mail (casse, espaces)", async () => {
    const data = await ok(loginSchema, { email: "  Alice@Example.COM ", password: "x" });
    assert.equal(data.email, "alice@example.com");
    assert.equal(data.password, "x");
  });

  it("refuse les e-mails mal formés avec un message neutre et le statut demandé", async () => {
    for (const email of ["", "alice", "alice@", "@example.com", "alice@example", "a b@example.com", "alice@exa mple.com", `${"a".repeat(250)}@example.com`, 12, null]) {
      const { status, error } = await ko(loginSchema, { email, password: "secret123" }, 401);
      assert.equal(status, 401);
      assert.equal(error, "Adresse e-mail ou mot de passe incorrect.", `e-mail ${JSON.stringify(email)}`);
    }
  });

  it("connexion : mot de passe de 1 à 128 caractères, sans rognage", async () => {
    assert.equal((await ok(loginSchema, { email: "a@example.com", password: " p " })).password, " p ");
    await ko(loginSchema, { email: "a@example.com", password: "" });
    await ko(loginSchema, { email: "a@example.com", password: "x".repeat(129) });
    assert.equal((await ok(loginSchema, { email: "a@example.com", password: "x".repeat(128) })).password, "x".repeat(128));
  });

  it("inscription : mot de passe d'au moins 8 caractères", async () => {
    const { error } = await ko(registerSchema, { email: "a@example.com", password: "1234567" });
    assert.equal(error, "Le mot de passe doit contenir au moins 8 caractères.");
    assert.equal((await ok(registerSchema, { email: "a@example.com", password: "12345678" })).password, "12345678");
    await ko(registerSchema, { email: "a@example.com", password: "x".repeat(129) });
    assert.equal((await ko(registerSchema, { email: "pas-un-mail", password: "12345678" })).error, "Adresse e-mail invalide.");
  });

  it("inscription : nom affiché optionnel, compacté, limité à 40 caractères", async () => {
    const base = { email: "a@example.com", password: "12345678" };
    assert.equal((await ok(registerSchema, base)).displayName, null);
    assert.equal((await ok(registerSchema, { ...base, displayName: "   " })).displayName, null);
    assert.equal((await ok(registerSchema, { ...base, displayName: "  Jean   Dupont " })).displayName, "Jean Dupont");
    assert.equal((await ok(registerSchema, { ...base, displayName: "x".repeat(40) })).displayName, "x".repeat(40));
    assert.equal(
      (await ko(registerSchema, { ...base, displayName: "x".repeat(41) })).error,
      "Le nom affiché doit contenir entre 1 et 40 caractères.",
    );
    await ko(registerSchema, { ...base, displayName: 5 });
  });

  it("inscription : localUserId optionnel, rogné, limité à 128", async () => {
    const base = { email: "a@example.com", password: "12345678" };
    assert.equal((await ok(registerSchema, { ...base, localUserId: " abc " })).localUserId, "abc");
    assert.equal((await ok(registerSchema, { ...base, localUserId: null })).localUserId, null);
    await ko(registerSchema, { ...base, localUserId: "x".repeat(129) });
  });
});

describe("partage", () => {
  it("shareSchema accepte null, {} et rotate booléen uniquement", async () => {
    assert.equal(validate(shareSchema, null).ok, true);
    assert.equal(validate(shareSchema, {}).ok, true);
    assert.equal((await ok(shareSchema, { rotate: true })).rotate, true);
    await ko(shareSchema, { rotate: "true" });
    await ko(shareSchema, { rotate: 1 });
  });

  it("shareTokenSchema : 16 à 128 caractères", () => {
    assert.equal(shareTokenSchema.safeParse("a".repeat(15)).success, false);
    assert.equal(shareTokenSchema.safeParse("a".repeat(16)).success, true);
    assert.equal(shareTokenSchema.safeParse("a".repeat(128)).success, true);
    assert.equal(shareTokenSchema.safeParse("a".repeat(129)).success, false);
    assert.equal(shareTokenSchema.safeParse(undefined).success, false);
  });
});

describe("readJsonBody", () => {
  const request = (body: string) => new Request("http://localhost/api", { method: "POST", body });

  it("un JSON mal formé vaut null", async () => {
    const share = await readJsonBody(request("{pas du json"), shareSchema);
    assert.equal(share.ok, true);
    const save = await readJsonBody(request("{pas du json"), saveLineSchema);
    assert.equal(save.ok, false);
    if (!save.ok) {
      assert.equal(save.response.status, 400);
      assert.deepEqual(await save.response.json(), { error: "Requête invalide." });
    }
  });

  it("lit et valide un corps JSON correct", async () => {
    const result = await readJsonBody(request(JSON.stringify({ printingId: "p", quantity: 2 })), saveLineSchema);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.quantity, 2);
  });
});
