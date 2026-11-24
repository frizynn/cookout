/**
 * The SDK's calls that mark one Nudge read, answer Keep on a Deactivation offer and mark an Automatic deactivation read. Their wire types and paths are in
 * `index.ts`.
 */
import type {
  AutomaticDeactivationId,
  AutomaticDeactivationResponse,
  DeactivationOfferId,
  DeactivationOfferResponse,
  NudgeId,
  NudgeResponse,
} from "./index.ts";

/** The SDK's call on a Nudge. */
export interface NudgeCalls {
  /**
   * `POST /v1/inbox/nudges/:id/read`: marks one of the caller's Nudges read and answers it. Another identity's nudge,
   * or one that doesn't exist, is 404 `nudge_not_found`. A nudge also turns read when its thread is closed or gets a
   * new message, and with `ackAll({ nudgesUpTo })`.
   */
  readonly markNudgeRead: (nudgeId: NudgeId) => Promise<NudgeResponse>;
}

/** The SDK's calls on a Deactivation offer and an Automatic deactivation. */
export interface DeactivationOfferCalls {
  /**
   * `POST /v1/inbox/deactivation-offers/:id/keep`: answers Keep on one of the caller's Deactivation offers, clearing it
   * for every recipient, and answers it. The next comes 30 days after it if the agent stays quiet. An offer the caller
   * didn't get, or one that doesn't exist, is 404 `deactivation_offer_not_found`. To deactivate instead, call
   * `deactivateIdentity`.
   */
  readonly keepDeactivationOffer: (offerId: DeactivationOfferId) => Promise<DeactivationOfferResponse>;
  /**
   * `POST /v1/inbox/automatic-deactivations/:id/read`: marks one of the caller's Automatic deactivations read, for every
   * recipient, and answers it. One the caller didn't get, or one that doesn't exist, is 404
   * `automatic_deactivation_not_found`. Reactivating the agent (`reactivateIdentity`) also reads it.
   */
  readonly markAutomaticDeactivationRead: (entryId: AutomaticDeactivationId) => Promise<AutomaticDeactivationResponse>;
}
