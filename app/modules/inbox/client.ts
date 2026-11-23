/**
 * The SDK's calls that mark the whole inbox, or one Nudge, read. Their wire types and paths are in `index.ts`.
 */
import type { AckAllRequest, AckAllResponse, NudgeId, NudgeResponse } from "./index.ts";
import type { MessageId } from "../messages/index.ts";

/** Marking inbox entries read without acking one message. */
export interface InboxReadCalls {
  /**
   * `POST /v1/inbox/ack-all`: marks every inbox item up to `upTo`, the newest the caller has seen, as read, in every
   * thread and channel at once, and answers the read positions it moved. An item after `upTo`, such as a message that
   * arrived since, stays unread. Pass `{ upTo, nudgesUpTo }` to mark every Nudge up to `nudgesUpTo` read too; either
   * may be left out.
   */
  readonly ackAll: (upTo: MessageId | AckAllRequest) => Promise<AckAllResponse>;
  /**
   * `POST /v1/inbox/nudges/:id/read`: marks one of the caller's Nudges read and answers it. Another identity's nudge,
   * or one that doesn't exist, is 404 `nudge_not_found`. A nudge also turns read when its thread is closed or gets a
   * new message.
   */
  readonly markNudgeRead: (nudgeId: NudgeId) => Promise<NudgeResponse>;
}
