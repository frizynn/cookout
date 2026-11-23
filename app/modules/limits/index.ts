/**
 * The per-identity limits on the wire, shared by the server, the SDK and the CLI: the codes a request over one is
 * refused with (ADR 0033).
 */

/**
 * The codes the limits refuse with, both 429: a request or command call over the identity's rate, and an events
 * stream over the identity's count of open ones. A `rate_limited` refusal's `details.retryAfterSeconds` says how
 * many whole seconds until the next one is allowed.
 */
export const limitErrorCodes = ["rate_limited", "too_many_streams"] as const;
