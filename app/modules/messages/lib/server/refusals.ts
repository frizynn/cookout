import type { MessageId } from "../../index.ts";
import type { Refusal } from "../../../http/index.ts";

interface MisplacedReply {
  readonly channel: string;
  readonly replyTo?: MessageId;
}

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

function channelNotFound(name: string): Refusal {
  return { code: "channel_not_found", message: `There is no channel named ${name}.`, status: NOT_FOUND };
}

function messageNotFound(asked: string): Refusal {
  return { code: "message_not_found", message: `There is no message ${asked}.`, status: NOT_FOUND };
}

function replyInOtherChannel({ channel, replyTo }: MisplacedReply): Refusal {
  return {
    code: "reply_in_other_channel",
    message: `Message ${String(replyTo)} is not in ${channel}. Reply in the message's own channel.`,
    status: BAD_REQUEST,
  };
}

export { channelNotFound, messageNotFound, replyInOtherChannel };
