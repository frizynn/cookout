import type {
  CookoutClient,
  CookoutEvent,
  Message,
  MessageId,
  MovedBackReadPosition,
  Refusal,
} from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";
import { refusalOf } from "../../sdk/index.ts";

const NOTHING_READ = 0;

type OnRefused = (refusal: Refusal) => void;

interface MarkUnread {
  readonly markUnread: (messageId: MessageId, onRefused: OnRefused) => void;
  readonly receive: (event: CookoutEvent) => boolean;
  readonly moveBack: (position: MovedBackReadPosition) => void;
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

interface Marking {
  readonly client: MarkUnreadOptions["client"];
  readonly messageId: MessageId;
  readonly onRefused: OnRefused;
}

async function movedOrRefused({ client, messageId, onRefused }: Marking): Promise<MovedBackReadPosition | null> {
  try {
    const { readPosition } = await client.markUnread(messageId);
    return readPosition;
  } catch (error: unknown) {
    onRefused(refusalOf(error));
    return null;
  }
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
    await Promise.allSettled([work()]);
    onChange();
  }

  async function markThenReadAgain(marking: Marking): Promise<void> {
    const moved = await movedOrRefused(marking);
    if (moved !== null) {
      moveBack(moved);
      await readAgain();
    }
  }

  return {
    markUnread: (messageId, onRefused) => {
      queue = after(queue, async () => {
        await markThenReadAgain({ client, messageId, onRefused });
      });
    },
    moveBack,
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
