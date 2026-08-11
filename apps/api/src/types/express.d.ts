declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      name: string;
      email: string;
      role: "ORGANIZER" | "CUSTOMER" | "GATEKEEPER";
    }

    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

export {};