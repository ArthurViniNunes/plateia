import { SignJWT } from "jose";

interface AccessTokenUser {
  id: string;
  role: string;
}

interface CreateAccessTokenOptions {
  user: AccessTokenUser;
  secret: string;
}

export function createAccessToken({
  user,
  secret,
}: CreateAccessTokenOptions): Promise<string> {
  return new SignJWT({
    role: user.role,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(user.id)
    .setIssuer("plateia-api")
    .setAudience("plateia-web")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(secret));
}
