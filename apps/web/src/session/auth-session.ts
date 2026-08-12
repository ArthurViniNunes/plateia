import { z } from "zod";

const authenticatedUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    email: z.email(),
    role: z.enum(["ORGANIZER", "CUSTOMER", "GATEKEEPER"]),
  })
  .strict();

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

const accessTokenKey = "plateia:access-token";
const authenticatedUserKey = "plateia:authenticated-user";
const sessionChangedEvent = "plateia:session-changed";

function notifySessionChanged() {
  window.dispatchEvent(new Event(sessionChangedEvent));
}

export function saveAuthenticatedSession(
  accessToken: string,
  user: AuthenticatedUser,
) {
  sessionStorage.setItem(accessTokenKey, accessToken);
  sessionStorage.setItem(authenticatedUserKey, JSON.stringify(user));

  notifySessionChanged();
}

export function readAuthenticatedUser(): AuthenticatedUser | null {
  const storedUser = sessionStorage.getItem(authenticatedUserKey);

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(storedUser) as unknown;
    const result = authenticatedUserSchema.safeParse(parsedUser);

    if (!result.success) {
      sessionStorage.removeItem(authenticatedUserKey);
      return null;
    }

    return result.data;
  } catch {
    sessionStorage.removeItem(authenticatedUserKey);
    return null;
  }
}

export function readAccessToken(): string | null {
  const accessToken = sessionStorage.getItem(accessTokenKey);

  if (!accessToken || accessToken.trim().length === 0) {
    sessionStorage.removeItem(accessTokenKey);
    return null;
  }

  return accessToken;
}

export function clearAuthenticatedSession() {
  sessionStorage.removeItem(accessTokenKey);
  sessionStorage.removeItem(authenticatedUserKey);

  notifySessionChanged();
}

export function subscribeToAuthenticatedSession(listener: () => void) {
  window.addEventListener(sessionChangedEvent, listener);

  return () => {
    window.removeEventListener(sessionChangedEvent, listener);
  };
}
