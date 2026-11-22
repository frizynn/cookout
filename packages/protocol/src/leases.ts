import { z } from "zod";
import { identityNameSchema } from "./identities.ts";

/**
 * The identity lease (spec #1, "Identity lease"; wiki
 * `decision-spec-defaults.md`, 2026-11-22, answer 1). An agent session takes
 * the lease for its token's identity with `join`, and sends the lease ID on
 * later requests in this header. Any request carrying the current lease ID
 * renews it; one carrying a lease ID that is no longer current is refused
 * with 409 `lease_lost`, so a session that lost the identity always hears it.
 *
 * Only ack and watch need the lease (chief-of-staff decision on cookout#6,
 * 2026-11-22); posting and reading don't, and the web UI never takes one.
 */
export const leaseHeader = "cookout-lease";

/** `POST /v1/lease` takes the lease (join); `DELETE /v1/lease` releases it (leave). */
export const leasePath = "/v1/lease";

/** How long a lease lasts after the last request that carried it, unless the server is told otherwise. */
export const defaultLeaseMilliseconds = 60_000;

/** The value `join` returns and a session sends in `cookout-lease` to show it holds the identity. */
export const leaseIdSchema = z.string().min(16).max(200);

/** `POST /v1/lease`. `as` must be the token's own identity: a check, not a switch. */
export const joinRequestSchema = z.object({
  as: identityNameSchema,
  /** Takes the lease even if another session holds it; that session's lease ID stops working at once. */
  force: z.boolean().optional(),
});
export type JoinRequest = z.infer<typeof joinRequestSchema>;

/** The answer to `join`. */
export const leaseResponseSchema = z.object({
  leaseId: leaseIdSchema,
  /** ISO 8601 UTC. Each request carrying the lease ID moves it forward. */
  expiresAt: z.iso.datetime(),
});
export type LeaseResponse = z.infer<typeof leaseResponseSchema>;

/** The answer to `leave`. */
export const leaveResponseSchema = z.object({ released: z.literal(true) });
export type LeaveResponse = z.infer<typeof leaveResponseSchema>;

/**
 * `details` of the lease errors (all 409): `lease_held` (join while another
 * session holds it), `lease_required` (an action that needs the lease, sent
 * without one) and `lease_lost` (the lease ID sent is no longer current:
 * taken over with `--force`, expired or released). `heldUntil` is when the
 * current holder's lease ends, or `null` if nobody holds it.
 */
export const leaseConflictDetailsSchema = z.object({ heldUntil: z.iso.datetime().nullable() });
export type LeaseConflictDetails = z.infer<typeof leaseConflictDetailsSchema>;
