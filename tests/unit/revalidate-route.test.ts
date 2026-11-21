/**
 * Route de revalidation du catalogue (src/app/api/revalidate/route.ts), appelée après /sync-prod.
 * revalidateTag est simulé (hors requête Next) : aucun cache réel touché.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, unstable_cache: <T>(fn: T) => fn }));

const SECRET = "revalidate-secret-test";
const saved = process.env.REVALIDATE_SECRET;

const call = async (authorization?: string) => {
  const { POST } = await import("@/app/api/revalidate/route");
  return POST(
    new Request("http://127.0.0.1/api/revalidate", {
      method: "POST",
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
};

beforeEach(() => {
  process.env.REVALIDATE_SECRET = SECRET;
  mocks.revalidateTag.mockReset();
});

afterEach(() => {
  if (saved === undefined) delete process.env.REVALIDATE_SECRET;
  else process.env.REVALIDATE_SECRET = saved;
});

describe("POST /api/revalidate", () => {
  it("bon secret : vide le cache du catalogue tout de suite", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("secret absent, faux ou non configuré : 401 sans rien vider", async () => {
    for (const header of [undefined, "", SECRET, `Bearer ${SECRET}x`, `bearer ${SECRET}`]) {
      expect((await call(header)).status, `en-tête ${JSON.stringify(header)}`).toBe(401);
    }
    delete process.env.REVALIDATE_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer undefined")).status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
