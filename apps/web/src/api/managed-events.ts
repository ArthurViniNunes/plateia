import { z } from "zod";

import { env } from "../config/env";

export const managedEventSchema = z
  .object({
    id: z.uuid(),
    ticketmasterId: z.string().min(1),
    title: z.string().min(1),
    imageUrl: z.url().nullable(),
    classification: z.string().nullable(),
    externalUrl: z.url().nullable(),
    startsAt: z.iso.datetime(),
    venue: z
      .object({
        name: z.string().min(1),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(1),
      })
      .strict(),
    priceInCents: z.number().int().positive(),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]),
    capacity: z.number().int().positive(),
  })
  .strict();

const managedEventsResponseSchema = z
  .object({
    events: z.array(managedEventSchema),
  })
  .strict();

export type ManagedEvent = z.infer<typeof managedEventSchema>;

export async function listManagedEvents(
  accessToken: string,
): Promise<ManagedEvent[]> {
  const response = await fetch(`${env.apiBaseUrl}/api/events/mine`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar os eventos.");
  }

  const payload: unknown = await response.json();

  return managedEventsResponseSchema.parse(payload).events;
}

export async function publishManagedEvent(
  eventId: string,
  accessToken: string,
): Promise<ManagedEvent> {
  const response = await fetch(
    `${env.apiBaseUrl}/api/events/${eventId}/publish`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível publicar o evento.");
  }

  const payload: unknown = await response.json();

  return managedEventSchema.parse(payload);
}

export async function cancelManagedEvent(
  eventId: string,
  accessToken: string,
): Promise<ManagedEvent> {
  const response = await fetch(
    `${env.apiBaseUrl}/api/events/${eventId}/cancel`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível cancelar o evento.");
  }

  const payload: unknown = await response.json();

  return managedEventSchema.parse(payload);
}
