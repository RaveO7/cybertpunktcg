import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOAuthState, exchangeOAuthCode, verifyOAuthState } from "@/lib/oauth";

const request = new Request("https://example.com/api/auth/oauth/google/callback");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function jwt(payload: unknown) {
  return `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
}

describe("validation des données OAuth externes", () => {
  beforeEach(() => {
    vi.stubEnv("OAUTH_STATE_SECRET", "secret-de-test-assez-long");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
    vi.stubEnv("APPLE_CLIENT_ID", "apple.id");
    vi.stubEnv("APPLE_TEAM_ID", "team");
    vi.stubEnv("APPLE_KEY_ID", "key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepte un state valide et refuse un autre fournisseur", () => {
    const state = createOAuthState("google", null);
    expect(verifyOAuthState(state, "google")).toEqual({ provider: "google", localUserId: null });
    expect(verifyOAuthState(state, "apple")).toBeNull();
  });

  it("refuse un state signé dont le contenu n'a pas la bonne forme", () => {
    const signed = (payload: unknown) => {
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return `${body}.${createHmac("sha256", "secret-de-test-assez-long").update(body).digest("base64url")}`;
    };
    const future = Date.now() + 60_000;
    expect(verifyOAuthState(signed({ p: "google", l: null, e: future }), "google")).not.toBeNull();
    expect(verifyOAuthState(signed({ p: "google", e: "demain" }), "google")).toBeNull();
    expect(verifyOAuthState(signed({ p: "google" }), "google")).toBeNull();
    expect(verifyOAuthState(signed({ p: 3, e: future }), "google")).toBeNull();
    expect(verifyOAuthState(signed("texte"), "google")).toBeNull();
    expect(verifyOAuthState(signed({ p: "google", e: Date.now() - 1 }), "google")).toBeNull();
    expect(verifyOAuthState("pas-un-state", "google")).toBeNull();
    expect(verifyOAuthState(`${createOAuthState("google", null).split(".")[0]}.signature-fausse`, "google")).toBeNull();
  });

  it("Google : un jeton sans access_token est refusé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ access_token: 42 })));
    await expect(exchangeOAuthCode("google", "code", request)).rejects.toThrow("OAUTH_TOKEN");
  });

  it("Google : un profil sans sub est refusé", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
        .mockResolvedValueOnce(jsonResponse({ email: "a@example.com" })),
    );
    await expect(exchangeOAuthCode("google", "code", request)).rejects.toThrow("OAUTH_PROFILE");
  });

  it("Google : un profil valide donne e-mail et nom, un champ mal typé est ignoré", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
        .mockResolvedValueOnce(jsonResponse({ sub: "123", email: "A@Example.com", name: 12 })),
    );
    const profile = await exchangeOAuthCode("google", "code", request);
    expect(profile).toMatchObject({ provider: "google", providerUserId: "123", email: "a@example.com" });
    expect(profile.displayName).toBeNull();
  });

  it("Apple : un id_token absent ou un JWT sans sub est refusé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(exchangeOAuthCode("apple", "code", request)).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id_token: jwt({ iss: "x" }) })));
    await expect(exchangeOAuthCode("apple", "code", request)).rejects.toThrow();
  });
});
