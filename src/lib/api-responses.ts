// Schémas des réponses de /api qui alimentent l'état des écrans (collection, souhaits, decks, partages,
// tournois, boutiques, historique de valeur). Le navigateur vérifie chaque réponse avant de l'utiliser
// (src/lib/client/api.ts) : une interface plus ancienne ou plus récente que le serveur échoue proprement.
// `zod/mini` : la version de Zod pensée pour le navigateur.
// Objets non stricts : un champ ajouté par un serveur plus récent est ignoré, un champ attendu absent fait échouer.
//
// Types simples : dérivés d'ici (`z.infer`), réexportés à leur emplacement habituel (`src/lib/types.ts`…).
// Types qui servent aussi aux calculs du serveur (boutiques, tournois, historique) : ils restent écrits à côté
// de ces calculs, et `tests/unit/api-responses.test.ts` vérifie à la compilation que chaque schéma leur correspond exactement.
import * as z from "zod/mini";

// --- Collection et compte ---

export const collectionItemSchema = z.object({
  id: z.string(),
  printingId: z.string(),
  conditionCode: z.string(),
  conditionName: z.string(),
  quantity: z.number(),
  notes: z.nullable(z.string()),
  purchasePrice: z.nullable(z.string()),
  purchaseCurrency: z.nullable(z.string()),
  /** Date d'achat « AAAA-MM-JJ », null = inconnue. */
  purchasedAt: z.nullable(z.string()),
  addedAt: z.string(),
});
export type CollectionItemDTO = z.infer<typeof collectionItemSchema>;

/** Résultat d'une modification de la collection : ligne à jour, ou ligne supprimée. */
export const mutationResultSchema = z.object({
  item: z.nullable(collectionItemSchema),
  deletedId: z.nullable(z.string()),
});
export type MutationResult = z.infer<typeof mutationResultSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Connexion, inscription, session. */
export const authResponseSchema = z.object({ user: authUserSchema });

/** Ouverture de session : compte et collection complète. */
export const collectionSessionSchema = z.object({ user: authUserSchema, items: z.array(collectionItemSchema) });

/** Collection rechargée après un ajout en lot. */
export const collectionItemsSchema = z.object({ items: z.array(collectionItemSchema) });

export const collectionImportSchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  items: z.array(collectionItemSchema),
});

/** Classeur partagé (vue publique) : nom du propriétaire et lignes, sans données privées. */
export const sharedBinderSchema = z.object({
  owner: z.object({ displayName: z.string() }),
  items: z.array(collectionItemSchema),
});

export const oauthProvidersSchema = z.object({ google: z.boolean(), apple: z.boolean() });

/** Lien de partage (classeur ou deck). */
export const shareInfoSchema = z.discriminatedUnion("active", [
  z.object({ active: z.literal(false) }),
  z.object({ active: z.literal(true), token: z.string(), path: z.string(), url: z.string(), createdAt: z.string() }),
]);
export type ShareInfo = z.infer<typeof shareInfoSchema>;

// --- Liste de souhaits ---

export const wishlistItemSchema = z.object({
  id: z.string(),
  printingId: z.string(),
  /** Prix cible en EUR (2 décimales), null = simple suivi sans alerte. */
  targetPrice: z.nullable(z.string()),
  notes: z.nullable(z.string()),
  /** Date à laquelle le prix est passé sous la cible (null si la cible n'est pas atteinte). */
  alertAt: z.nullable(z.string()),
  alertPrice: z.nullable(z.string()),
  alertSeen: z.boolean(),
  createdAt: z.string(),
});
export type WishlistItemDTO = z.infer<typeof wishlistItemSchema>;

export const wishlistSchema = z.object({ items: z.array(wishlistItemSchema) });
export const wishlistItemResponseSchema = z.object({ item: wishlistItemSchema });
export const wishlistBulkSchema = z.object({
  added: z.number(),
  alreadyPresent: z.number(),
  items: z.array(wishlistItemSchema),
});

/** Suppression (souhait, deck) : id supprimé, null s'il n'existait plus. */
export const deletedSchema = z.object({ deletedId: z.nullable(z.string()) });

// --- Decks ---

export const deckSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.nullable(z.string()),
  /** Cartes de jeu (Card.id) et nombre d'exemplaires, Legends comprises. */
  cards: z.array(z.object({ cardId: z.string(), quantity: z.number() })),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DeckDTO = z.infer<typeof deckSchema>;

export const decksSchema = z.object({ decks: z.array(deckSchema) });
export const deckResponseSchema = z.object({ deck: deckSchema });

// --- Tournois (liste du compte) ---

export const tournamentListSchema = z.object({
  tournaments: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      status: z.enum(["inscriptions", "suisse", "top_cut", "termine", "annule"]),
      format: z.enum(["boutique", "competitif"]),
      createdAt: z.string(),
      role: z.nullable(z.enum(["owner", "co"])),
      playerCount: z.number(),
    }),
  ),
});
export type TournamentListItem = z.infer<typeof tournamentListSchema>["tournaments"][number];

/** Tournoi créé : la console s'ouvre sur son id. */
export const createdTournamentSchema = z.object({ tournament: z.object({ id: z.string() }) });

/** Inscription par QR personnel ou depuis la fiche publique : code du tournoi rejoint. */
export const tournamentCodeSchema = z.object({ code: z.string() });

/** Invitation de co-organisateur acceptée. */
export const organizerInviteSchema = z.object({ tournamentId: z.string() });

// --- Boutiques ---

export const placeSchema = z.object({
  venueName: z.nullable(z.string()),
  address: z.string(),
  postalCode: z.nullable(z.string()),
  city: z.string(),
  region: z.nullable(z.string()),
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
});

// --- Annuaire des tournois publics et recherche de lieux ---

export const publicDirectorySchema = z.object({
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  tournaments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(["inscriptions", "suisse", "top_cut", "termine", "annule"]),
      startsAt: z.nullable(z.string()),
      timeZone: z.nullable(z.string()),
      venueName: z.nullable(z.string()),
      city: z.nullable(z.string()),
      region: z.nullable(z.string()),
      country: z.nullable(z.string()),
      lat: z.nullable(z.number()),
      lng: z.nullable(z.number()),
      format: z.enum(["boutique", "competitif"]),
      matchType: z.enum(["bo1", "bo3"]),
      entryFeeCents: z.nullable(z.number()),
      currency: z.string(),
      maxPlayers: z.nullable(z.number()),
      playerCount: z.number(),
      waitlistCount: z.number(),
      seatsLeft: z.nullable(z.number()),
      registrationOpen: z.boolean(),
      shop: z.nullable(z.object({ slug: z.string(), name: z.string(), verified: z.boolean(), logoUrl: z.nullable(z.string()) })),
      distanceKm: z.nullable(z.number()),
    }),
  ),
});

export const directoryFacetsSchema = z.object({
  countries: z.array(z.string()),
  regions: z.array(z.string()),
  cities: z.array(z.object({ key: z.string(), name: z.string() })),
});

export const citySuggestionsSchema = z.object({
  cities: z.array(z.object({ city: z.string(), region: z.nullable(z.string()), country: z.string(), lat: z.number(), lng: z.number() })),
});

export const addressSuggestionSchema = z.extend(placeSchema, { label: z.string() });
export const addressSuggestionsSchema = z.object({ suggestions: z.array(addressSuggestionSchema) });
export const resolvedAddressSchema = z.object({ place: addressSuggestionSchema });

export const shopSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  region: z.nullable(z.string()),
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
  verified: z.boolean(),
  logoUrl: z.nullable(z.string()),
  distanceKm: z.nullable(z.number()),
});

export const shopDetailSchema = z.extend(shopSummarySchema, {
  description: z.nullable(z.string()),
  website: z.nullable(z.string()),
  socials: z.array(z.object({ kind: z.string(), url: z.string() })),
  phone: z.nullable(z.string()),
  contactEmail: z.nullable(z.string()),
  hours: z.nullable(z.string()),
  place: placeSchema,
});

export const ownedShopSchema = z.extend(shopDetailSchema, {
  status: z.enum(["pending", "verified", "rejected"]),
  reviewNote: z.nullable(z.string()),
  reviewedAt: z.nullable(z.string()),
  createdAt: z.string(),
});

export const adminShopSchema = z.extend(ownedShopSchema, {
  owner: z.object({ id: z.string(), email: z.nullable(z.string()), displayName: z.string() }),
});

/** Tournois rattachés à une boutique (fiche de gestion). */
export const attachedTournamentsSchema = z.object({
  tournaments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      visibility: z.string(),
      startsAt: z.nullable(z.string()),
      timeZone: z.nullable(z.string()),
    }),
  ),
});

export const ownedShopsSchema = z.object({ shops: z.array(ownedShopSchema), isAdmin: z.boolean() });
export const ownedShopResponseSchema = z.object({ shop: ownedShopSchema });
export const adminShopsSchema = z.object({ shops: z.array(adminShopSchema) });
export const shopDirectorySchema = z.object({
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  shops: z.array(shopSummarySchema),
});
export type ShopDirectoryResult = z.infer<typeof shopDirectorySchema>;

// --- Historique de la valeur de la collection ---

export const portfolioPointSchema = z.object({
  day: z.string(),
  marketTotal: z.number(),
  pricedCopies: z.number(),
  invested: z.optional(z.number()),
  profit: z.optional(z.nullable(z.number())),
});

export const portfolioPurchaseSchema = z.object({
  day: z.string(),
  printingId: z.string(),
  quantity: z.number(),
  unitPrice: z.nullable(z.number()),
  currency: z.nullable(z.string()),
});

export const portfolioHistoryResponseSchema = z.object({
  points: z.array(portfolioPointSchema),
  purchases: z.array(portfolioPurchaseSchema),
});

/** Courbe du prix d'un tirage (fiche carte). */
export const printingHistorySchema = z.object({
  points: z.array(z.object({ day: z.string(), amount: z.number() })),
});

/** Prix de chaque carte au premier jour d'une durée (null : aucun prix connu). */
export const referencePricesSchema = z.object({
  day: z.nullable(z.string()),
  prices: z.record(z.string(), z.number()),
});

// --- Tournoi (vue d'un écran : console de l'organisateur, page du joueur) ---

const matchKindSchema = z.enum(["normal", "bye", "double_loss", "id", "no_show"]);
const matchResultSchema = z.object({ kind: matchKindSchema, gamesA: z.number(), gamesB: z.number() });
const organizerRoleSchema = z.enum(["owner", "co"]);

export const playerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "active", "dropped", "dq", "waitlist"]),
  waitlistPosition: z.nullable(z.number()),
  hasApp: z.boolean(),
  isAccount: z.boolean(),
  joinedRound: z.number(),
  dqReason: z.nullable(z.string()),
  cutDeclined: z.boolean(),
});

export const matchViewSchema = z.object({
  id: z.string(),
  table: z.number(),
  slot: z.nullable(z.number()),
  playerAId: z.string(),
  playerBId: z.nullable(z.string()),
  status: z.enum(["en_cours", "declare", "conteste", "valide"]),
  kind: matchKindSchema,
  gamesA: z.nullable(z.number()),
  gamesB: z.nullable(z.number()),
  declA: z.nullable(matchResultSchema),
  declB: z.nullable(matchResultSchema),
  declaredAt: z.nullable(z.string()),
  confirmedOnSite: z.boolean(),
  extraSeconds: z.number(),
  version: z.number(),
  overdue: z.boolean(),
});

export const roundViewSchema = z.object({
  id: z.string(),
  number: z.number(),
  phase: z.enum(["swiss", "top_cut"]),
  status: z.enum(["draft", "published", "running", "closed"]),
  startedAt: z.nullable(z.string()),
  durationSeconds: z.number(),
  pausedAt: z.nullable(z.string()),
  pausedSeconds: z.number(),
  addedSeconds: z.number(),
  matches: z.array(matchViewSchema),
});

export const matchLogViewSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  action: z.string(),
  actorUserId: z.nullable(z.string()),
  actorPlayerId: z.nullable(z.string()),
  before: z.unknown(),
  after: z.unknown(),
  at: z.string(),
});

export const standingSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  status: z.enum(["pending", "active", "dropped", "dq", "waitlist"]),
  rank: z.number(),
  points: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  matchesPlayed: z.number(),
  matchWinPct: z.number(),
  gameWinPct: z.number(),
  omwPct: z.number(),
  gwPct: z.number(),
  ogwPct: z.number(),
  opponentIds: z.array(z.string()),
  hadBye: z.boolean(),
});

export const finalStandingSchema = z.extend(standingSchema, {
  finalRank: z.number(),
  cutRoundsReached: z.number(),
  champion: z.boolean(),
});

export const cutDrawSchema = z.object({ tied: z.array(z.string()), picked: z.array(z.string()), at: z.string() });

export const tournamentViewSchema = z.object({
  revision: z.number(),
  serverNow: z.string(),
  role: z.enum(["organizer", "player", "public"]),
  organizerRole: z.nullable(organizerRoleSchema),
  me: z.nullable(playerViewSchema),
  tournament: z.object({
    id: z.string(),
    code: z.nullable(z.string()),
    name: z.string(),
    format: z.enum(["boutique", "competitif"]),
    matchType: z.enum(["bo1", "bo3"]),
    status: z.enum(["inscriptions", "suisse", "top_cut", "termine", "annule"]),
    roundMinutes: z.number(),
    topCutExtraMinutes: z.number(),
    topCutSetting: z.string(),
    swissRounds: z.number(),
    registrationOpen: z.boolean(),
    requireApproval: z.boolean(),
    oneDeviceMode: z.enum(["direct", "organizer"]),
    declareTimeoutMinutes: z.number(),
    lateEntryPolicy: z.enum(["zero", "loss"]),
    championId: z.nullable(z.string()),
    cutSeeds: z.array(z.string()),
    cutDraws: z.array(cutDrawSchema),
    visibility: z.enum(["private", "public"]),
    startsAt: z.nullable(z.string()),
    timeZone: z.nullable(z.string()),
    place: z.nullable(placeSchema),
    entryFeeCents: z.nullable(z.number()),
    currency: z.string(),
    maxPlayers: z.nullable(z.number()),
    description: z.nullable(z.string()),
    prizes: z.nullable(z.string()),
    shop: z.nullable(z.object({ id: z.string(), name: z.string(), slug: z.string(), status: z.string() })),
  }),
  players: z.array(playerViewSchema),
  rounds: z.array(roundViewSchema),
  standings: z.array(standingSchema),
  finalStandings: z.nullable(z.array(finalStandingSchema)),
  organizers: z.array(z.object({ userId: z.string(), name: z.string(), role: organizerRoleSchema })),
  /** Organisateur seulement. */
  logs: z.array(matchLogViewSchema),
});

/** Sondage de l'état : vue complète, ou seulement l'heure du serveur si la révision n'a pas bougé. */
export const tournamentStateSchema = z.union([
  z.object({ unchanged: z.literal(true), revision: z.number(), serverNow: z.string() }),
  tournamentViewSchema,
]);

const commandWarningSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rematch"), a: z.string(), b: z.string() }),
  z.object({ type: z.literal("second_bye"), playerId: z.string() }),
  z.object({ type: z.literal("draft_outdated") }),
  z.object({ type: z.literal("correction_after_pairing"), matchId: z.string() }),
]);

/** Action de l'organisateur appliquée : avertissements (appariements…) et données utiles à l'écran. */
export const commandResultSchema = z.object({
  ok: z.literal(true),
  warnings: z.optional(z.array(commandWarningSchema)),
  data: z.optional(z.record(z.string(), z.unknown())),
  replayed: z.optional(z.boolean()),
});
