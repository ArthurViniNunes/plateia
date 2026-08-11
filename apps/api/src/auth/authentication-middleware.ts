import type { RequestHandler } from "express";
import { jwtVerify } from "jose";

import { prisma } from "../database/prisma.js";

interface CreateAuthenticationMiddlewareOptions {
  jwtSecret: string;
}

function respondUnauthorized(response: Parameters<RequestHandler>[1]): void {
  response.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required",
    },
  });
}

export function createAuthenticationMiddleware({
  jwtSecret,
}: CreateAuthenticationMiddlewareOptions): RequestHandler {
  const secret = new TextEncoder().encode(jwtSecret);

  return async (request, response, next) => {
    const authorization = request.header("authorization");
    const [scheme, token, extra] = authorization?.split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined) {
      respondUnauthorized(response);
      return;
    }

    let subject: string;

    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: "plateia-api",
        audience: "plateia-web",
      });

      if (!payload.sub || typeof payload.role !== "string") {
        respondUnauthorized(response);
        return;
      }

      subject = payload.sub;
    } catch {
      respondUnauthorized(response);
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: subject,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      respondUnauthorized(response);
      return;
    }

    request.authenticatedUser = user;
    next();
  };
}
