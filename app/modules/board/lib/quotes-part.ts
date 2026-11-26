import type { CookoutClient, CookoutEvent, Message, MessageId } from "../../sdk/index.ts";
import { threadOfMessage } from "./messages-table.ts";

const NONE = 0;
const ONE = 1;

type Quotes = ReadonlyMap<MessageId, Message | null>;

type QuotesClient = Pick<CookoutClient, "getThread">;

interface QuotesPart {
  readonly state: () => Quotes;
  readonly apply: (event: CookoutEvent) => void;
  readonly back: () => void;
  readonly show: (id: MessageId) => void;
  readonly hide: (id: MessageId) => void;
}

interface QuotesPartOptions {
  readonly client: QuotesClient;
  readonly changed: () => void;
}

interface Gone {
  readonly deleted: Message;
  readonly held: Message | null;
}

const NOTHING: Quotes = new Map();

async function quoted(client: QuotesClient, id: MessageId): Promise<Message | null> {
  try {
    const { parent, replies } = await client.getThread(id);
    return [parent, ...replies].find((message) => message.id === id) ?? null;
  } catch {
    return null;
  }
}

function goneWith({ deleted, held }: Gone): boolean {
  if (held === null) {
    return false;
  }
  return held.id === deleted.id || (deleted.kind === "top-level" && threadOfMessage(held) === deleted.id);
}

function createQuotesPart({ changed, client }: QuotesPartOptions): QuotesPart {
  let state = NOTHING;
  const readers = new Map<MessageId, number>();
  const reads = new Map<MessageId, Promise<void>>();
  function put(id: MessageId, message: Message | null): void {
    state = new Map(state).set(id, message);
    changed();
  }
  async function readInto(id: MessageId): Promise<void> {
    put(id, await quoted(client, id));
  }
  function read(id: MessageId): void {
    reads.set(id, readInto(id));
  }
  return {
    apply: (event) => {
      if (event.type !== "message-deleted") {
        return;
      }
      for (const [id, held] of state) {
        if (goneWith({ deleted: event.message, held })) {
          put(id, null);
        }
      }
    },
    back: () => {
      for (const [id, count] of readers) {
        if (count > NONE) {
          read(id);
        }
      }
    },
    hide: (id) => {
      readers.set(id, (readers.get(id) ?? ONE) - ONE);
    },
    show: (id) => {
      readers.set(id, (readers.get(id) ?? NONE) + ONE);
      if (!reads.has(id)) {
        read(id);
      }
    },
    state: () => state,
  };
}

export type { Quotes, QuotesClient, QuotesPart };
export { createQuotesPart };
