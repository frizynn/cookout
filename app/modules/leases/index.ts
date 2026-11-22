/**
 * The identity lease on the wire, shared by the server, the SDK and the CLI:
 * the `LeaseId` brand and its check, the header a session sends it in, the
 * requests and answers of join and leave, and the error codes the lease
 * refuses with.
 */

declare const brand: unique symbol;

/** The value `join` returns and a session sends in `cookout-lease` to show it holds the identity. */
export type LeaseId = string & { readonly [brand]: "LeaseId" };

/** The rule every lease ID the server issues follows, for the backend's Schemas. */
export const leaseIdPattern = /^lease_[\w-]{1,200}$/u;

/**
 * Whether `value` looks like a lease ID the server issued; if so, it is a `LeaseId`.
 * @param value The string to check.
 * @returns Whether `value` is a `LeaseId`.
 */
export function isLeaseId(value: string): value is LeaseId {
  return leaseIdPattern.test(value);
}

/**
 * The header a session sends its lease ID in. Any request carrying the live
 * lease ID renews it. A lease ID that is no longer live renews nothing, and
 * only the actions that need the lease refuse it.
 */
export const leaseHeader = "cookout-lease";

/** `POST /v1/lease` takes the lease (join); `DELETE /v1/lease` releases it (leave). */
export const leasePath = "/v1/lease";

/** The body of `POST /v1/lease`. `as` must be the token's own identity: a check, not a switch. */
export interface JoinRequest {
  readonly as: string;
  /** Takes the lease even if another session holds it; that session's lease ID stops working at once. */
  readonly force?: boolean;
}

/** The answer to `join`. */
export interface LeaseResponse {
  readonly leaseId: LeaseId;
  /** ISO 8601 UTC. Each request carrying the lease ID moves it forward. */
  readonly expiresAt: string;
}

/** The answer to `leave`. */
export interface LeaveResponse {
  readonly released: true;
}

/**
 * The `details` of the 409 lease refusals: when the current holder's lease
 * ends, or `null` if nobody holds the identity.
 */
export interface LeaseConflictDetails {
  readonly heldUntil: string | null;
}

/**
 * The codes the lease refuses with: `not_your_identity` (403, join as another
 * identity), and the 409s `lease_held` (join while another session holds it),
 * `lease_required` (an action that needs the lease, sent without one) and
 * `lease_lost` (the lease ID sent is no longer live: taken over, expired or released).
 */
export const leaseErrorCodes = ["not_your_identity", "lease_held", "lease_required", "lease_lost"] as const;
