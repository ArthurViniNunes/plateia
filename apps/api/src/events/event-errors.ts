export class EventNotFoundError extends Error {
  constructor() {
    super("Event not found");
    this.name = "EventNotFoundError";
  }
}

export class EventCannotBePublishedError extends Error {
  constructor() {
    super("Event cannot be published");
    this.name = "EventCannotBePublishedError";
  }
}
