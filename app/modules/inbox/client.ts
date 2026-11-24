/**
 * The SDK's call that marks one Nudge read. Its wire types and path are in `index.ts`.
 */
import type { NudgeId, NudgeResponse } from "./index.ts";

/** The SDK's call on a Nudge. */
export interface NudgeCalls {
  /**
   * `POST /v1/inbox/nudges/:id/read`: marks one of the caller's Nudges read and answers it. Another identity's nudge,
   * or one that doesn't exist, is 404 `nudge_not_found`. A nudge also turns read when its thread is closed or gets a
   * new message, and with `ackAll({ nudgesUpTo })`.
   */
  readonly markNudgeRead: (nudgeId: NudgeId) => Promise<NudgeResponse>;
}
