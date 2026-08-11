import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      message: "Password must contain at most 72 bytes",
    }),
});
