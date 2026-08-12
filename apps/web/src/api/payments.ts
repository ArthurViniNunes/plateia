import { z } from "zod";

import { env } from "../config/env";

const paymentResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["PAID", "REJECTED"]),
    totalInCents: z.number().int().positive(),
    tickets: z.array(
      z
        .object({
          id: z.uuid(),
          code: z.string().min(32),
          eventId: z.uuid(),
          seat: z
            .object({
              id: z.uuid(),
              rowLabel: z.string().min(1),
              number: z.number().int().positive(),
            })
            .strict(),
        })
        .strict(),
    ),
  })
  .strict();

export type PaymentOutcome = "APPROVED" | "DECLINED";
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

interface ProcessPaymentInput {
  reservationId: string;
  accessToken: string;
  outcome: PaymentOutcome;
}

export async function processPayment({
  reservationId,
  accessToken,
  outcome,
}: ProcessPaymentInput): Promise<PaymentResponse> {
  const response = await fetch(
    `${env.apiBaseUrl}/api/reservations/${reservationId}/payment`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        outcome,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível processar o pagamento.");
  }

  const payload: unknown = await response.json();

  return paymentResponseSchema.parse(payload);
}
