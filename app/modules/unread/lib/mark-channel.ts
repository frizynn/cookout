import type { ChannelName, CookoutClient, InboxItem, MessageId } from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";

interface MarkChannelOptions {
  readonly client: Pick<CookoutClient, "ack">;
  readonly items: InboxItems;
  readonly onRead: (item: InboxItem) => void;
  readonly onChange: () => void;
}

function placeOf(item: InboxItem): string {
  if (item.message.kind === "reply") {
    return String(item.message.replyTo);
  }
  return "channel";
}

function newestByPlace(items: readonly InboxItem[], channel: ChannelName): readonly MessageId[] {
  const newest = new Map<string, MessageId>();
  for (const item of items) {
    if (item.channel.name === channel) {
      newest.set(placeOf(item), item.message.id);
    }
  }
  return [...newest.values()];
}

function createMarkChannel(options: MarkChannelOptions): (channel: ChannelName) => void {
  const { client, items, onChange, onRead } = options;
  let marking: Promise<void> = Promise.resolve();

  async function ackOne(messageId: MessageId): Promise<void> {
    const { readPosition } = await client.ack(messageId);
    items.readAll([readPosition], onRead);
    onChange();
  }

  async function markAfter(previous: Promise<void>, newest: readonly MessageId[]): Promise<void> {
    await previous;
    await Promise.allSettled(
      newest.map(async (messageId) => {
        await ackOne(messageId);
      }),
    );
  }

  return (channel) => {
    marking = markAfter(marking, newestByPlace(items.list(), channel));
  };
}

export { createMarkChannel };
