import { compare, hash } from "bcrypt";
import { Router } from "express";

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../database/prisma.js";
import { createAccessToken } from "./create-access-token.js";
import { loginSchema } from "./login-schema.js";
import { registerSchema } from "./register-schema.js";
import { createAuthenticationMiddleware } from "./authentication-middleware.js";

interface CreateAuthRouterOptions {
  jwtSecret: string;
}

export function createAuthRouter({ jwtSecret }: CreateAuthRouterOptions) {
  const authRouter = Router();

  const authenticationMiddleware = createAuthenticationMiddleware({
    jwtSecret,
  });

  authRouter.post("/register", async (request, response) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
        },
      });
      return;
    }

    const input = result.data;
    const passwordHash = await hash(input.password, 12);

    try {
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      response.status(201).json(user);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        response.status(409).json({
          error: {
            code: "EMAIL_ALREADY_REGISTERED",
            message: "Email already registered",
          },
        });
        return;
      }

      throw error;
    }
  });

  authRouter.post("/login", async (request, response) => {
    const result = loginSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
        },
      });
      return;
    }

    const input = result.data;

    const user = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    const passwordMatches =
      user !== null && (await compare(input.password, user.passwordHash));

    if (!user || !passwordMatches) {
      response.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
      return;
    }

    const token = await createAccessToken({
      user,
      secret: jwtSecret,
    });

    response.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });

  authRouter.get(
    "/me",
    authenticationMiddleware,
    (request, response) => {
      const user = request.authenticatedUser;

      if (!user) {
        response.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
        return;
      }

      response.status(200).json(user);
    },
  );

  return authRouter;
}