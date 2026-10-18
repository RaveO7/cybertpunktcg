/**
 * Session mémorisée sur l'appareil. Cf. specs/account/session.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  LEGACY_SIGNED_IN_KEY,
  SESSION_USER_KEY,
  clearSessionUser,
  readSessionUser,
  writeSessionUser,
  type HintStorage,
} from "../../src/lib/session-hint";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: HintStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { storage, data };
}

const throwing: HintStorage = {
  getItem: () => {
    throw new Error("indisponible");
  },
  setItem: () => {
    throw new Error("indisponible");
  },
  removeItem: () => {
    throw new Error("indisponible");
  },
};

const USER = { id: "u1", displayName: "Ada", email: "ada@example.com" };

describe("session mémorisée", () => {
  it("fait l'aller-retour écriture puis lecture", () => {
    const { storage } = memoryStorage();
    writeSessionUser(storage, USER);
    assert.deepEqual(readSessionUser(storage), USER);
  });

  it("ne mémorise que les champs d'affichage", () => {
    const { storage, data } = memoryStorage();
    writeSessionUser(storage, { ...USER, token: "secret" } as typeof USER);
    assert.deepEqual(JSON.parse(data.get(SESSION_USER_KEY) ?? ""), USER);
  });

  it("renvoie null sans valeur", () => {
    assert.equal(readSessionUser(memoryStorage().storage), null);
    assert.equal(readSessionUser(null), null);
  });

  it("renvoie null sur du JSON corrompu", () => {
    const { storage } = memoryStorage({ [SESSION_USER_KEY]: "{pas du json" });
    assert.equal(readSessionUser(storage), null);
  });

  it("renvoie null quand des champs manquent ou sont mal typés", () => {
    for (const value of [{ id: "u1", displayName: "Ada" }, { ...USER, id: "" }, { ...USER, id: 3 }, null, "u1", [USER]]) {
      const { storage } = memoryStorage({ [SESSION_USER_KEY]: JSON.stringify(value) });
      assert.equal(readSessionUser(storage), null, JSON.stringify(value));
    }
  });

  it("tolère un stockage qui lève", () => {
    assert.equal(readSessionUser(throwing), null);
    assert.doesNotThrow(() => writeSessionUser(throwing, USER));
    assert.doesNotThrow(() => clearSessionUser(throwing));
  });

  it("efface l'ancien indice à l'écriture", () => {
    const { storage, data } = memoryStorage({ [LEGACY_SIGNED_IN_KEY]: "1" });
    writeSessionUser(storage, USER);
    assert.equal(data.has(LEGACY_SIGNED_IN_KEY), false);
  });

  it("efface la session et l'ancien indice", () => {
    const { storage, data } = memoryStorage({ [LEGACY_SIGNED_IN_KEY]: "1" });
    writeSessionUser(storage, USER);
    data.set(LEGACY_SIGNED_IN_KEY, "1");
    clearSessionUser(storage);
    assert.equal(readSessionUser(storage), null);
    assert.equal(data.size, 0);
  });
});
