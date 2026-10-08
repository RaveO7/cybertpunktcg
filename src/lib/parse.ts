// Partagé client/serveur : ne pas importer Zod ici (alourdirait le bundle client).
// La validation des entrées API est dans api-schemas.ts.
export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
