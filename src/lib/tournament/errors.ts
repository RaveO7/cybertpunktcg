// Refus métier d'une action de tournoi : message affichable + statut HTTP.

export class TournamentError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "TournamentError";
  }
}

export function fail(message: string, status = 400, details?: unknown): never {
  throw new TournamentError(message, status, details);
}
