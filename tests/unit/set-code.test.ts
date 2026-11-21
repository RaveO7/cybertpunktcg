import { describe, expect, it } from "vitest";
import { canonicalSetCode } from "@/lib/set-code";

const SOURCE = [
  "welcometonightcityretail",
  "welcometonightcityretail-fr",
  "nightcitybrawls1",
  "nightcitybrawls1-FR",
  "embracingpowerretailstarterdeck",
  "embracingpowerretailstarterde-fr",
  "prereleaseretail",
  "prereleaseretail-FR",
  "PRM01",
];

describe("canonicalSetCode", () => {
  it("garde les codes anglais et ceux déjà en « -fr »", () => {
    expect(canonicalSetCode("PRM01", SOURCE)).toBe("PRM01");
    expect(canonicalSetCode("welcometonightcityretail-fr", SOURCE)).toBe("welcometonightcityretail-fr");
  });

  it("ramène « -FR » au suffixe « -fr » du code anglais", () => {
    expect(canonicalSetCode("nightcitybrawls1-FR", SOURCE)).toBe("nightcitybrawls1-fr");
    expect(canonicalSetCode("prereleaseretail-FR", SOURCE)).toBe("prereleaseretail-fr");
  });

  it("complète un code anglais tronqué", () => {
    expect(canonicalSetCode("embracingpowerretailstarterde-fr", SOURCE)).toBe("embracingpowerretailstarterdeck-fr");
  });

  it("préfixe ambigu ou inconnu : code d'origine en minuscules de suffixe", () => {
    expect(canonicalSetCode("welcometonight-fr", [...SOURCE, "welcometonightcitybeta"])).toBe("welcometonight-fr");
    expect(canonicalSetCode("inconnu-FR", SOURCE)).toBe("inconnu-fr");
  });
});
