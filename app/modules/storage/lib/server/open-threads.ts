import { Array as Arr, Order, Predicate } from "effect";
import type { Message, MessageId, TopLevelMessage } from "../../../messages/index.ts";
import type { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { OpenThread } from "../../../messages/client.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface OpenThreadsCursor {
  readonly lastActivityAt: IsoTime;
  readonly id: MessageId;
}

interface OpenThreadsPageRequest {
  readonly all: boolean;
  readonly after?: OpenThreadsCursor;
  readonly limit: number;
}

interface StoredOpenThreadsPage {
  readonly threads: readonly OpenThread[];
  readonly hasMore: boolean;
}

interface OpenThreadsSection {
  readonly listOpenThreads: (identity: IdentityName, page: OpenThreadsPageRequest) => Fails<StoredOpenThreadsPage>;
}

interface ThreadActivity {
  readonly parent: TopLevelMessage;
  readonly replies: readonly Message[];
  readonly reopenedAt: IsoTime | undefined;
}

const byActivity: Order.Order<OpenThread> = Order.combine(
  Order.mapInput(Order.String, (thread: OpenThread) => thread.lastActivityAt),
  Order.mapInput(Order.Number, (thread: OpenThread) => thread.message.id),
);

function lastActivityOf({ parent, replies, reopenedAt }: ThreadActivity): IsoTime {
  const times = [parent.createdAt, ...Arr.map(replies, (reply) => reply.createdAt), reopenedAt ?? parent.createdAt];
  return Arr.reduce(times, parent.createdAt, Order.max<IsoTime>(Order.String));
}

interface Involving {
  readonly identity: IdentityName;
  readonly messages: readonly Message[];
}

interface Paging {
  readonly threads: readonly OpenThread[];
  readonly page: OpenThreadsPageRequest;
}

function involves({ identity, messages }: Involving): boolean {
  return Arr.some(messages, ({ author, mentions }) => author.name === identity || mentions.includes(identity));
}

function isAfter(cursor: OpenThreadsCursor | undefined): (thread: OpenThread) => boolean {
  return ({ lastActivityAt, message }) =>
    Predicate.isUndefined(cursor) ||
    lastActivityAt > cursor.lastActivityAt ||
    (lastActivityAt === cursor.lastActivityAt && message.id > cursor.id);
}

function pageOfOpenThreads({ page, threads }: Paging): StoredOpenThreadsPage {
  const after = Arr.filter(Arr.sort(threads, byActivity), isAfter(page.after));
  return { hasMore: after.length > page.limit, threads: Arr.take(after, page.limit) };
}

export {
  type OpenThreadsCursor,
  type OpenThreadsPageRequest,
  type OpenThreadsSection,
  type StoredOpenThreadsPage,
  involves,
  lastActivityOf,
  pageOfOpenThreads,
};
