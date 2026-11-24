import { Array as Arr, Option, Order, Predicate, pipe } from "effect";
import type { Message, Reply, TopLevelMessage } from "../../../messages/index.ts";
import type { ParsedQuery, SearchResult } from "../../../search/index.ts";
import type { SearchCursor, SearchPageRequest, SearchSection, StoredSearchPage } from "./search.ts";
import { counted, threadIdOf } from "./messages.ts";
import type { Effect } from "effect";
import type { StorageUnavailable } from "./errors.ts";
import { matchesQuery } from "../../../search/index.ts";

type Read = <Value>(work: (messages: readonly Message[]) => Value) => Effect.Effect<Value, StorageUnavailable>;

const newestFirst: Order.Order<Message> = Order.flip(
  Order.combine(
    Order.mapInput(Order.String, (message: Message) => message.createdAt),
    Order.mapInput(Order.Number, (message: Message) => message.id),
  ),
);

function isOlderThan(cursor: SearchCursor | undefined): (message: Message) => boolean {
  return ({ createdAt, id }) =>
    Predicate.isUndefined(cursor) || createdAt < cursor.createdAt || (createdAt === cursor.createdAt && id < cursor.id);
}

function isTopLevel(message: Message): message is TopLevelMessage {
  return message.kind === "top-level";
}

function shownIn(messages: readonly Message[], message: Message): Message {
  if (!isTopLevel(message)) {
    return message;
  }
  const replies = Arr.filter(
    messages,
    (reply): reply is Reply => reply.kind === "reply" && reply.replyTo === message.id,
  );
  return counted({ parent: message, replies });
}

function resultIn(messages: readonly Message[]): (message: Message) => SearchResult {
  return (message) => {
    const thread = pipe(
      Arr.findFirst(messages, ({ id }) => id === threadIdOf(message)),
      Option.filter(isTopLevel),
    );
    const threadClosed = Option.exists(thread, ({ closedAt }) => Predicate.isNotUndefined(closedAt));
    return { message: shownIn(messages, message), threadClosed };
  };
}

interface Searching {
  readonly messages: readonly Message[];
  readonly query: ParsedQuery;
  readonly page: SearchPageRequest;
}

function searchIn({ messages, page, query }: Searching): StoredSearchPage {
  const matching = Arr.filter(messages, ({ text }) => matchesQuery({ query, text }));
  const found = Arr.filter(Arr.sort(matching, newestFirst), isOlderThan(page.after));
  return { hasMore: found.length > page.limit, results: Arr.map(Arr.take(found, page.limit), resultIn(messages)) };
}

function memorySearch(read: Read): SearchSection {
  return { searchMessages: (query, page) => read((messages) => searchIn({ messages, page, query })) };
}

export { memorySearch };
