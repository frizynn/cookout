import type { Message, MessageId } from "../../sdk/index.ts";
import { hrefOf } from "../../paths/index.ts";

function threadIdOf(message: Message): MessageId {
  if (message.kind === "top-level") {
    return message.id;
  }
  return message.replyTo;
}

function messageHrefOf(message: Message): string {
  return hrefOf({ channel: message.channel, message: message.id, name: "thread", thread: threadIdOf(message) });
}

export { messageHrefOf };
