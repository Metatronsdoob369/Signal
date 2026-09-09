import { createHash, randomBytes } from "node:crypto";

export function generateSiteToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Embed key. It is printed into every client page, so it is public by design and stored
 * in plaintext; it can load the pack and post beacons for its site, and nothing else.
 */
export function generatePublicKey(): string {
  return randomBytes(18).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
