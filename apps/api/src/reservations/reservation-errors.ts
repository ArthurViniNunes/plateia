export class SeatsUnavailableError extends Error {
  constructor() {
    super("Selected seats are unavailable");
    this.name = "SeatsUnavailableError";
  }
}
