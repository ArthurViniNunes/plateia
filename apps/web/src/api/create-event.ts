import { managedEventSchema, type ManagedEvent } from "./managed-events";
import { env } from "../config/env";

export interface CreateEventInput {
  ticketmasterId: string;
  startsAt: string;
  venue: {
    name: string;
    address: string;
    city: string;
    state: string;
  };
  priceInCents: number;
  rows: Array<{
    label: string;
    seatCount: number;
  }>;
}

export async function createEvent(
  input: CreateEventInput,
  accessToken: string,
): Promise<ManagedEvent> {
  const response = await fetch(`${env.apiBaseUrl}/api/events`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Não foi possível criar o evento.");
  }

  const payload: unknown = await response.json();

  return managedEventSchema.parse(payload);
}
