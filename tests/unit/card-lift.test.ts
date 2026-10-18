/**
 * Carte soulevée du tutoriel : rectangle agrandi et place de la fiche zoom.
 * Cf. specs/tutorial/card-inspection.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { LIFT_SCALE, liftRect, placeZoom, zoomSize, type Rect, type Size } from "../../src/components/card-lift";

const SCREEN: Size = { width: 1440, height: 900 };

function overlaps(a: Rect, b: Rect) {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

function zoomRect(card: Rect, zoom: Size, viewport = SCREEN): Rect {
  const { x, y } = placeZoom(card, zoom, viewport);
  return { left: x, top: y, ...zoom };
}

function inside(r: Rect, viewport = SCREEN) {
  return r.left >= 0 && r.top >= 0 && r.left + r.width <= viewport.width && r.top + r.height <= viewport.height;
}

describe("liftRect", () => {
  it("agrandit la largeur de mise en page et reste centrée sur la carte", () => {
    const lift = liftRect({ left: 600, top: 500, width: 120, height: 168 }, 120, SCREEN);
    assert.equal(lift.width, 120 * LIFT_SCALE);
    assert.equal(lift.height, lift.width * 1.4);
    assert.equal(lift.left + lift.width / 2, 660);
    assert.equal(lift.top + lift.height / 2, 584);
  });

  it("se base sur la largeur de mise en page, pas sur la boîte d'une carte inclinée", () => {
    // Boîte englobante d'une carte tournée : plus large que la carte elle-même.
    const lift = liftRect({ left: 600, top: 500, width: 150, height: 180 }, 120, SCREEN);
    assert.equal(lift.width, 120 * LIFT_SCALE);
  });

  it("reste entière dans l'écran pour une carte collée au bas", () => {
    const lift = liftRect({ left: 600, top: 900 - 168, width: 120, height: 168 }, 120, SCREEN);
    assert.ok(inside(lift));
    assert.equal(lift.top + lift.height, 900);
  });

  it("reste entière dans l'écran pour une carte collée en haut à gauche", () => {
    const lift = liftRect({ left: 0, top: 0, width: 120, height: 168 }, 120, SCREEN);
    assert.equal(lift.left, 0);
    assert.equal(lift.top, 0);
  });
});

describe("placeZoom", () => {
  const zoom = zoomSize(SCREEN);

  it("place la fiche au-dessus quand la place suffit", () => {
    const card = liftRect({ left: 600, top: 650, width: 120, height: 168 }, 120, SCREEN);
    const r = zoomRect(card, zoom);
    assert.ok(r.top + r.height <= card.top);
    assert.ok(!overlaps(r, card));
    assert.ok(inside(r));
  });

  it("place la fiche en dessous près du haut de l'écran", () => {
    const card = liftRect({ left: 600, top: 20, width: 120, height: 168 }, 120, SCREEN);
    const r = zoomRect(card, zoom);
    assert.ok(r.top >= card.top + card.height);
    assert.ok(!overlaps(r, card));
    assert.ok(inside(r));
  });

  it("place la fiche à côté quand ni le haut ni le bas ne suffisent", () => {
    const low: Size = { width: 1000, height: 520 };
    const card = liftRect({ left: 300, top: 150, width: 140, height: 196 }, 140, low);
    const z = zoomSize(low);
    const r = zoomRect(card, z, low);
    assert.ok(!overlaps(r, card));
    assert.ok(inside(r, low));
  });

  it("à côté, passe à gauche quand la droite manque de place", () => {
    const low: Size = { width: 1000, height: 520 };
    const card = liftRect({ left: 800, top: 150, width: 140, height: 196 }, 140, low);
    const r = zoomRect(card, zoomSize(low), low);
    assert.ok(r.left + r.width <= card.left);
  });

  it("une fiche plus haute que l'estimation (texte long) ne recouvre pas la carte", () => {
    const card = liftRect({ left: 600, top: 560, width: 150, height: 210 }, 150, SCREEN);
    const estimate = zoomSize(SCREEN);
    const measured = zoomSize(SCREEN, estimate.height + 60);
    assert.equal(measured.height, estimate.height + 60);
    const r = zoomRect(card, measured);
    assert.ok(!overlaps(r, card));
    assert.ok(inside(r));
  });

  it("la hauteur mesurée ne fait jamais descendre l'estimation", () => {
    assert.equal(zoomSize(SCREEN, 10).height, zoomSize(SCREEN).height);
  });
});
