import type { RequestHandler } from "express";

type Role = Express.AuthenticatedUser["role"];

export function requireRoles(...allowedRoles: Role[]): RequestHandler {
  return (request, response, next) => {
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

    if (!allowedRoles.includes(user.role)) {
      response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        },
      });
      return;
    }

    next();
  };
}
