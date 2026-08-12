import { z } from "zod";

import { env } from "../config/env";

export const ticketSchema = z
  .object({
    id: z.uuid(),
    code: z.string().min(32),
    status: z.enum(["VALID", "USED", "CANCELLED"]),
    event: z
      .object({
        id: z.uuid(),
        title: z.string().min(1),
        startsAt: z.iso.datetime(),
        venue: z
          .object({
            name: z.string().min(1),
            city: z.string().min(1),
            state: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
    seat: z
      .object({
        id: z.uuid(),
        rowLabel: z.string().min(1),
        number: z.number().int().positive(),
      })
      .strict(),
    sharePath: z.string().min(1),
  })
  .strict();

const ticketsResponseSchema = z
  .object({
    tickets: z.array(ticketSchema),
  })
  .strict();

export type Ticket = z.infer<typeof ticketSchema>;

export async function listTickets(accessToken: string): Promise<Ticket[]> {
  const response = await fetch(`${env.apiBaseUrl}/api/tickets`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar os ingressos.");
  }

  const payload: unknown = await response.json();

  return ticketsResponseSchema.parse(payload).tickets;
}

export async function getSharedTicket(code: string): Promise<Ticket> {
  const response = await fetch(
    `${env.apiBaseUrl}/api/tickets/${encodeURIComponent(code)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar o ingresso.");
  }

  const payload: unknown = await response.json();

  return ticketSchema.parse(payload);
}
