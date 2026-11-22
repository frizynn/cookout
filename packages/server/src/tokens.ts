import { createHash, randomBytes } from "node:crypto";

/**
 * The real token source: `cookout_` and 32 random bytes (256 bits) in
 * base64url. Start-up passes it to `startServer` as `newToken`.
 */
export function randomToken(): string {
  return `cookout_${randomBytes(32).toString("base64url")}`;
}

/**
 * The real lease ID source: `lease_` and 16 random bytes in base64url.
 * Start-up passes it to `startServer` as `newLeaseId`.
 */
export function randomLeaseId(): string {
  return `lease_${randomBytes(16).toString("base64url")}`;
}

/**
 * What the store keeps instead of the token. Tokens carry 256 random bits,
 * so a plain SHA-256 is enough; no salt or slow hash is needed.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
