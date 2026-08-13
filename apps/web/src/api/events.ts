import { z } from "zod";

import { env } from "../config/env";

const eventSchema = z.object({
  id: z.uuid(),
  ticketmasterId: z.string(),
  title: z.string(),
  imageUrl: z.url().nullable(),
  classification: z.string().nullable(),
  externalUrl: z.url().nullable(),
  startsAt: z.iso.datetime(),
  venue: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  priceInCents: z.number().int().positive(),
  status: z.literal("PUBLISHED"),
  capacity: z.number().int().positive(),
});

const eventsResponseSchema = z.object({
  data: z.array(eventSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const eventDetailsSchema = eventSchema.extend({
  rows: z.array(
    z.object({
      label: z.string(),
      seats: z.array(
        z.object({
          id: z.uuid(),
          number: z.number().int().positive(),
          status: z.enum(["AVAILABLE", "BLOCKED", "SOLD"]),
        }),
      ),
    }),
  ),
});

export type PublicEvent = z.infer<typeof eventSchema>;
export type EventDetails = z.infer<typeof eventDetailsSchema>;

async function requestJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  const payload: unknown = await response.json();

  return payload;
}

export async function listEvents() {
  const payload = await requestJson(
    `${env.apiBaseUrl}/api/events?page=1&limit=12`,
  );

  return eventsResponseSchema.parse(payload);
}

export async function getEvent(eventId: string) {
  const payload = await requestJson(`${env.apiBaseUrl}/api/events/${eventId}`);

  return eventDetailsSchema.parse(payload);
}
