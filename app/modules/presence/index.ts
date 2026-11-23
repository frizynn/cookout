/**
 * Presence on the wire, shared by the server, the SDK, the CLI and the web: whether each identity is online, and if
 * not, when it was last seen (GLOSSARY.md, Presence and Online; ADR "presence comes from live connections"). Every
 * word the wire uses for it (the path, the event's `type`, the CLI's field) is named here once, so renaming the term
 * is one change.
 */
import type { IdentityName } from "../identities/index.ts";
import type { IsoTime } from "../time/index.ts";

/** The wire's word for the feature: the CLI's field, the event's `type` and the last part of the path. */
export const presenceName = "presence";

/** How an online identity is connected: a `cookout watch`, with the host its agent session was joined from when the joining client sent one, or a web tab. */
export type LiveConnectionDetail = { readonly via: "watch"; readonly host?: string } | { readonly via: "web" };

/**
 * Why an offline identity went offline, as its profile shows it ("offline: session revoked"): it ran `cookout leave`,
 * its token was refused (an agent session revoked or expired, an Identity token rotated, the identity deactivated), or
 * its connection dropped and nothing reconnected within the grace (ADR "how a live connection ends").
 */
export const offlineReasons = [
  "left",
  "session revoked",
  "session expired",
  "token rotated",
  "deactivated",
  "connection lost",
] as const;

/** One of `offlineReasons`. */
export type OfflineReason = (typeof offlineReasons)[number];

/**
 * One identity's presence. An online identity carries the detail of its most recent live connection, unless it shows
 * online only because the server just restarted (the boot grace). An offline one carries when it was last seen, unless
 * it never was, and why it went offline when the server knows. A Deactivated identity is always offline.
 */
export interface Presence {
  readonly identity: IdentityName;
  readonly online: boolean;
  readonly connection?: LiveConnectionDetail;
  readonly lastSeenAt?: IsoTime;
  readonly offlineReason?: OfflineReason;
}

/** The answer to `GET /v1/presence`: every identity's presence, Deactivated ones included, sorted by name. */
export interface PresenceResponse {
  readonly presence: readonly Presence[];
}

/** `GET /v1/presence`: every identity's presence, answering `PresenceResponse`. */
export const presencePath = `/v1/${presenceName}`;

/**
 * The code of the `refusal` event that ends an agent's live connection when a newer one opens: an agent holds one
 * live connection at most, and `cookout watch` exits 6 on it (ADR "one live connection per agent").
 */
export const watchReplaced = "watch_replaced";

/** The codes presence ends a stream with. */
export const presenceErrorCodes = [watchReplaced] as const;
