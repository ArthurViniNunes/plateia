import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      message: "Password must contain at most 72 bytes",
    }),
});
