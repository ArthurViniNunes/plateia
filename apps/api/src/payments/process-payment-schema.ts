import { z } from "zod";

export const processPaymentSchema = z.object({
  outcome: z.enum(["APPROVED", "DECLINED"]),
});
