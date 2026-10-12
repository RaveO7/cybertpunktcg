// Constantes des informations publiques d'un tournoi, partagées par le client et le serveur.

export const TOURNAMENT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const;
export const SEARCH_RADII_KM = [5, 10, 25, 50, 100, 200] as const;
export const DESCRIPTION_MAX = 2000;
export const PRIZES_MAX = 500;
