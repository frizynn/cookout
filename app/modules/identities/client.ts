/**
 * The calls a client makes on one identity by its name: reading it, and setting or clearing an agent's description
 * (#189). The SDK's `CookoutClient` has them.
 */
declare const brand: unique symbol;

/**
 * An agent's description: what the agent handles, written for people and for routing, such as "Matt's to-dos, life
 * admin and voice-note follow-ups". 1–500 characters with no space at either end. A human has none.
 */
export type Description = string & { readonly [brand]: "Description" };

/** The description rule, in UTF-16 code units as `String.length` counts them, after trimming. */
export const descriptionLength = { maximum: 500, minimum: 1 } as const;

/**
 * Whether `value` is trimmed and the length of a description.
 *
 * @param value The text to check.
 * @returns Whether it is a `Description`.
 */
export function isDescription(value: string): value is Description {
  return (
    value === value.trim() && value.length >= descriptionLength.minimum && value.length <= descriptionLength.maximum
  );
}

/**
 * `GET /v1/identities/:name` (any identity) answers the identity, or 404 `identity_not_found`. `PATCH` with
 * `UpdateIdentityRequest` sets or clears an agent's description, answering `IdentityResponse`.
 */
export const identityPath = "/v1/identities/:name";

/** The body of `PATCH /v1/identities/:name`. */
export interface UpdateIdentityRequest {
  /** What the agent handles, trimmed, then 1–500 characters (400 `invalid_request` otherwise), or `null` to clear it. */
  readonly description: string | null;
}

/** Reading one identity, and describing an agent. `Answer` is the `IdentityResponse` both answer with. */
export interface DescriptionCalls<Answer> {
  /** `GET /v1/identities/:name`: one identity, with its description if it is an agent with one. Any identity may. */
  readonly getIdentity: (name: string) => Promise<Answer>;
  /**
   * `PATCH /v1/identities/:name`: sets (trimmed, 1–500 characters) or clears (`null`) an agent's description, which
   * every identity on the board then reads. The agent itself, the human who owns it or an admin may (403 `not_owner`
   * otherwise); a human has no description (403 `identity_kind`).
   */
  readonly setDescription: (name: string, description: string | null) => Promise<Answer>;
}
