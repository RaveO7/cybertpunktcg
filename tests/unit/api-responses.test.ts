/**
 * Schémas des réponses de /api dont le type reste écrit côté serveur (boutiques, historique, liste des
 * tournois) : chaque schéma doit décrire exactement ce type, ni plus strict ni plus lâche. Vérifié par
 * `npm run typecheck` (expectTypeOf) ; les tests de tests/db vérifient les réponses réelles des routes.
 */
import { describe, expectTypeOf, it } from "vitest";
import type * as z from "zod/mini";
import type {
  addressSuggestionSchema,
  adminShopSchema,
  citySuggestionsSchema,
  commandResultSchema,
  directoryFacetsSchema,
  publicDirectorySchema,
  attachedTournamentsSchema,
  ownedShopSchema,
  placeSchema,
  portfolioPointSchema,
  portfolioPurchaseSchema,
  printingHistorySchema,
  referencePricesSchema,
  shopDetailSchema,
  shopSummarySchema,
  TournamentListItem,
  tournamentViewSchema,
} from "../../src/lib/api-responses";
import type { AddressSuggestion, CitySuggestion } from "../../src/lib/geo/geocode";
import type { Place } from "../../src/lib/geo/location";
import type { PortfolioPurchase, loadReferencePrices } from "../../src/lib/investment-history";
import type { PortfolioHistoryPoint, buildPrintingHistory } from "../../src/lib/price-history";
import type { AdminShop, OwnedShop, ShopDetail, ShopSummary, listAttachedTournaments } from "../../src/lib/shops/shops";
import type { CommandResult, listTournaments } from "../../src/lib/tournament/commands";
import type { DirectoryFacets, DirectoryResult } from "../../src/lib/tournament/directory";
import type { TournamentView } from "../../src/lib/tournament/view";

// Type aplati à tous les niveaux : la comparaison distingue `A & B` d'un objet aux mêmes champs.
type Flat<T> = T extends object ? { [K in keyof T]: Flat<T[K]> } : T;

describe("schémas des réponses = types du serveur", () => {
  it("boutiques", () => {
    expectTypeOf<z.infer<typeof placeSchema>>().toEqualTypeOf<Place>();
    expectTypeOf<z.infer<typeof shopSummarySchema>>().toEqualTypeOf<ShopSummary>();
    expectTypeOf<z.infer<typeof shopDetailSchema>>().toEqualTypeOf<Flat<ShopDetail>>();
    expectTypeOf<z.infer<typeof ownedShopSchema>>().toEqualTypeOf<Flat<OwnedShop>>();
    expectTypeOf<z.infer<typeof adminShopSchema>>().toEqualTypeOf<Flat<AdminShop>>();
    expectTypeOf<z.infer<typeof attachedTournamentsSchema>["tournaments"]>().toEqualTypeOf<Awaited<ReturnType<typeof listAttachedTournaments>>>();
  });

  it("historique de la valeur", () => {
    expectTypeOf<z.infer<typeof portfolioPointSchema>>().toEqualTypeOf<PortfolioHistoryPoint>();
    expectTypeOf<z.infer<typeof portfolioPurchaseSchema>>().toEqualTypeOf<PortfolioPurchase>();
    expectTypeOf<z.infer<typeof printingHistorySchema>["points"]>().toEqualTypeOf<ReturnType<typeof buildPrintingHistory>>();
    expectTypeOf<z.infer<typeof referencePricesSchema>>().toEqualTypeOf<Awaited<ReturnType<typeof loadReferencePrices>>>();
  });

  it("liste des tournois du compte", () => {
    expectTypeOf<TournamentListItem>().toEqualTypeOf<Awaited<ReturnType<typeof listTournaments>>[number]>();
  });

  it("vue d'un tournoi (console, page du joueur)", () => {
    type View = z.infer<typeof tournamentViewSchema>;
    expectTypeOf<View>().toEqualTypeOf<Flat<TournamentView>>();
  });

  it("résultat d'une action d'organisateur", () => {
    expectTypeOf<z.infer<typeof commandResultSchema>>().toEqualTypeOf<Flat<CommandResult>>();
  });

  it("annuaire public et recherche de lieux", () => {
    expectTypeOf<z.infer<typeof publicDirectorySchema>>().toEqualTypeOf<Flat<DirectoryResult>>();
    expectTypeOf<z.infer<typeof directoryFacetsSchema>>().toEqualTypeOf<DirectoryFacets>();
    expectTypeOf<z.infer<typeof citySuggestionsSchema>["cities"][number]>().toEqualTypeOf<CitySuggestion>();
    expectTypeOf<z.infer<typeof addressSuggestionSchema>>().toEqualTypeOf<Flat<AddressSuggestion>>();
  });
});
