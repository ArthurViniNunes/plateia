import { z } from "zod";

import { env } from "../config/env";

const loginResponseSchema = z
  .object({
    token: z.string().min(1),
    user: z
      .object({
        id: z.uuid(),
        name: z.string().min(1),
        email: z.email(),
        role: z.enum(["ORGANIZER", "CUSTOMER", "GATEKEEPER"]),
      })
      .strict(),
  })
  .strict();

interface LoginInput {
  email: string;
  password: string;
}

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("E-mail ou senha incorretos.");
    this.name = "InvalidCredentialsError";
  }
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await fetch(`${env.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw new InvalidCredentialsError();
  }

  if (!response.ok) {
    throw new Error("Não foi possível realizar o login.");
  }

  const payload: unknown = await response.json();

  return loginResponseSchema.parse(payload);
}
