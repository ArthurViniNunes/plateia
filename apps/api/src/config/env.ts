import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535),
  CORS_ORIGIN: z
    .url()
    .refine((value) => new URL(value).origin === value, {
      message: "CORS_ORIGIN must contain only the URL origin",
    }),
  JWT_SECRET: z.coerce.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  TICKETMASTER_API_KEY: z
    .string()
    .trim()
    .min(1)
    .optional(),
});

export function parseEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}