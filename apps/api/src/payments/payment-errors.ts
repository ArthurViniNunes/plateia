export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reservation not found");
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationExpiredError extends Error {
  constructor() {
    super("Reservation has expired");
    this.name = "ReservationExpiredError";
  }
}

export class ReservationCannotBePaidError extends Error {
  constructor() {
    super("Reservation cannot be paid");
    this.name = "ReservationCannotBePaidError";
  }
}
