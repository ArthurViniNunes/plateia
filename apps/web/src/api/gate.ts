import { z } from "zod";

import { env } from "../config/env";

const validResultSchema = z
  .object({
    result: z.literal("VALID"),
    validatedAt: z.iso.datetime(),
    ticket: z
      .object({
        id: z.uuid(),
        eventId: z.uuid(),
        seat: z
          .object({
            rowLabel: z.string().min(1),
            number: z.number().int().positive(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const rejectedResultSchema = z
  .object({
    result: z.enum(["INVALID", "ALREADY_USED", "WRONG_EVENT"]),
  })
  .strict();

const gateResultSchema = z.union([validResultSchema, rejectedResultSchema]);

interface ValidateTicketInput {
  eventId: string;
  code: string;
  accessToken: string;
}

export type GateResult = z.infer<typeof gateResultSchema>;

export async function validateTicket({
  eventId,
  code,
  accessToken,
}: ValidateTicketInput): Promise<GateResult> {
  const response = await fetch(`${env.apiBaseUrl}/api/gate/validate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível validar o ingresso.");
  }

  const payload: unknown = await response.json();

  return gateResultSchema.parse(payload);
}
