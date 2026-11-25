import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "../../src/lib/api-schemas";
import { isAllowedPushEndpoint } from "../../src/lib/push-endpoint";

/** Endpoints Web Push : seuls les services push des navigateurs sont acceptés (anti-SSRF). */
describe("isAllowedPushEndpoint", () => {
  it("accepte les services push de Chrome/Edge, Firefox, Safari et Windows", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx9",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), true, url);
    }
  });

  it("refuse HTTP, adresses IP, hôtes internes, faux sous-domaines, identifiants et ports", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "https://localhost/x",
      "https://push.example.com/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evilpush.apple.com.evil.com/x",
      "https://notify.windows.com/x",
      "https://xnotify.windows.com/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "not a url",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), false, url);
    }
  });

  it("est appliqué par les schémas d'abonnement et de désabonnement", () => {
    const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
    assert.equal(pushSubscribeSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/a", keys }).success, true);
    assert.equal(pushSubscribeSchema.safeParse({ endpoint: "https://10.0.0.5/hook", keys }).success, false);
    assert.equal(pushUnsubscribeSchema.safeParse({ endpoint: "https://10.0.0.5/hook" }).success, false);
  });
});
