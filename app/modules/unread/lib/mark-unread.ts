import type { CookoutClient, CookoutEvent, Message, MessageId, MovedBackReadPosition } from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";

const NOTHING_READ = 0;

interface MarkUnread {
  readonly markUnread: (messageId: MessageId) => void;
  readonly receive: (event: CookoutEvent) => boolean;
}

interface MarkUnreadOptions {
  readonly client: Pick<CookoutClient, "inbox" | "markUnread">;
  readonly items: InboxItems;
  readonly dropRead: (isUnreadAgain: (message: Message) => boolean) => void;
  readonly onChange: () => void;
}

function isIn(position: MovedBackReadPosition, message: Message): boolean {
  if (message.channel !== position.channel) {
    return false;
  }
  if (message.kind === "reply") {
    return message.replyTo === position.thread;
  }
  return position.thread === null;
}

function createMarkUnread({ client, dropRead, items, onChange }: MarkUnreadOptions): MarkUnread {
  let queue: Promise<void> = Promise.resolve();

  function moveBack(position: MovedBackReadPosition): void {
    items.moveBack(position);
    dropRead((message) => isIn(position, message) && message.id > (position.messageId ?? NOTHING_READ));
    onChange();
  }

  async function readAgain(): Promise<void> {
    const inbox = await client.inbox();
    items.addAll(inbox.items);
  }

  async function after(previous: Promise<void>, work: () => Promise<void>): Promise<void> {
    await previous;
    try {
      await work();
      onChange();
    } catch {
      onChange();
    }
  }

  async function markThenReadAgain(messageId: MessageId): Promise<void> {
    const { readPosition } = await client.markUnread(messageId);
    moveBack(readPosition);
    await readAgain();
  }

  return {
    markUnread: (messageId) => {
      queue = after(queue, async () => {
        await markThenReadAgain(messageId);
      });
    },
    receive: (event) => {
      if (event.type !== "read-position-moved-back") {
        return false;
      }
      moveBack(event.readPosition);
      queue = after(queue, readAgain);
      return true;
    },
  };
}

export { type MarkUnread, createMarkUnread };
