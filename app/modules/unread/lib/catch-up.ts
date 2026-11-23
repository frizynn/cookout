import type { CookoutClient, InboxItem, MessageId, MovedBackReadPosition, ReadPosition } from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";

type ByPlace = ReadonlyMap<string, MessageId>;

interface CatchUpOptions {
  readonly client: Pick<CookoutClient, "inbox" | "readPositions">;
  readonly items: InboxItems;
  readonly moveBack: (position: MovedBackReadPosition) => void;
  readonly onRead: (item: InboxItem) => void;
}

interface Compared {
  readonly before: ByPlace;
  readonly now: ByPlace;
  readonly server: ByPlace;
}

function placeOf({ channel, thread }: Pick<ReadPosition, "channel" | "thread">): string {
  return `${channel}/${String(thread)}`;
}

function byPlace(all: readonly ReadPosition[]): ByPlace {
  return new Map(all.map((position) => [placeOf(position), position.messageId]));
}

function unchanged({ before, now }: Compared, place: string): boolean {
  return (before.get(place) ?? null) === (now.get(place) ?? null);
}

function isBehind(server: MessageId | null, held: MessageId): boolean {
  return server === null || server < held;
}

function movedBack(compared: Compared, held: readonly ReadPosition[]): readonly MovedBackReadPosition[] {
  const moved: MovedBackReadPosition[] = [];
  for (const { channel, messageId, thread } of held) {
    const place = placeOf({ channel, thread });
    const server = compared.server.get(place) ?? null;
    if (unchanged(compared, place) && isBehind(server, messageId)) {
      moved.push({ channel, messageId: server, thread });
    }
  }
  return moved;
}

async function catchUp(options: CatchUpOptions): Promise<void> {
  const { client, items } = options;
  const before = byPlace(items.readPositions());
  const [inbox, { readPositions }] = await Promise.all([client.inbox(), client.readPositions()]);
  const held = items.readPositions();
  const compared: Compared = { before, now: byPlace(held), server: byPlace(readPositions) };
  for (const position of movedBack(compared, held)) {
    options.moveBack(position);
  }
  const movedOn = readPositions.filter((position) => unchanged(compared, placeOf(position)));
  items.readAll(movedOn, options.onRead);
  items.addAll(inbox.items);
}

interface CatchingUp extends CatchUpOptions {
  readonly onChange: () => void;
}

function catchingUp(options: CatchingUp): () => void {
  let queue: Promise<void> = Promise.resolve();
  async function after(previous: Promise<void>): Promise<void> {
    await previous;
    await Promise.allSettled([catchUp(options)]);
    options.onChange();
  }
  return () => {
    queue = after(queue);
  };
}

export { catchingUp };
