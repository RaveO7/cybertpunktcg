/**
 * Export SQL des sauvegardes (scripts/backup-prod.ts) : ordre des tables et valeurs littérales.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { Prisma } from "@prisma/client";
import { literal, tablesInForeignKeyOrder } from "../../scripts/sql-dump";

describe("sauvegarde SQL", () => {
  it("chaque table vient après celles qu'elle référence, toutes présentes une fois", () => {
    const order = tablesInForeignKeyOrder();
    const models = Prisma.dmmf.datamodel.models;
    assert.equal(order.length, models.length);
    assert.equal(new Set(order).size, models.length);
    for (const model of models) {
      for (const field of model.fields.filter((entry) => entry.relationFromFields?.length)) {
        if (field.type === model.name) continue;
        assert.ok(order.indexOf(field.type) < order.indexOf(model.name), `${field.type} avant ${model.name}`);
      }
    }
  });

  it("valeurs littérales Postgres : texte échappé, décimal, binaire, date, nul", () => {
    assert.equal(literal("l'ami"), "'l''ami'");
    assert.equal(literal(new Prisma.Decimal("12.50")), "12.5");
    assert.equal(literal(new Uint8Array([0, 255, 16])), "'\\x00ff10'");
    assert.equal(literal(new Date("2026-11-21T10:00:00.000Z")), "'2026-11-21 10:00:00.000'");
    assert.equal(literal(null), "NULL");
  });
});
