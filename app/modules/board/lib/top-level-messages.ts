import type { ChannelName, CookoutClient, Message, Reply, TopLevelMessage } from "../../sdk/index.ts";
import { withNewestReply } from "../../messages/index.ts";

interface Page {
  readonly hasMore: boolean;
  readonly messages: readonly TopLevelMessage[];
}

interface Paging {
  readonly client: Pick<CookoutClient, "listMessages">;
  readonly name: ChannelName;
  readonly pageSize: number;
}

interface Reaching {
  readonly paging: Paging;
  readonly newestShown: number;
  readonly page: Page;
}

interface Shown {
  readonly messages: readonly TopLevelMessage[];
}

const NOTHING_SHOWN = 0;
const NONE_KEPT = 0;

async function reachingBack({ newestShown, page, paging }: Reaching): Promise<Page> {
  const oldest = Math.min(...page.messages.map((message) => message.id));
  if (!page.hasMore || oldest <= newestShown) {
    return page;
  }
  const older = await paging.client.listMessages(paging.name, { before: oldest, limit: paging.pageSize });
  const reached = await reachingBack({ newestShown, page: older, paging });
  return { hasMore: reached.hasMore, messages: [...reached.messages, ...page.messages] };
}

interface Since extends Paging {
  readonly shown: readonly TopLevelMessage[];
}

async function newestSince(paging: Since): Promise<Page> {
  const { shown } = paging;
  const newest = await paging.client.listMessages(paging.name, { limit: paging.pageSize });
  const newestShown = Math.max(NOTHING_SHOWN, ...shown.map((message) => message.id));
  const page = await reachingBack({ newestShown, page: newest, paging });
  return page;
}

interface Joining {
  readonly shown: Page;
  readonly page: Page;
}

function withNewest({ page, shown }: Joining): Page {
  const oldest = Math.min(...page.messages.map((message) => message.id));
  const kept = shown.messages.filter((message) => message.id < oldest);
  if (kept.length === NONE_KEPT) {
    return page;
  }
  return { hasMore: shown.hasMore, messages: [...kept, ...page.messages] };
}

function withReply(parent: TopLevelMessage, reply: Reply): TopLevelMessage {
  if (parent.id !== reply.replyTo || (parent.latestReplyId !== null && parent.latestReplyId >= reply.id)) {
    return parent;
  }
  return withNewestReply({ parent, reply });
}

interface Receiving<Showing extends Shown> {
  readonly shown: Showing;
  readonly message: Message;
}

function received<Showing extends Shown>({ message, shown }: Receiving<Showing>): Showing {
  if (message.kind === "reply") {
    return { ...shown, messages: shown.messages.map((parent) => withReply(parent, message)) };
  }
  if (shown.messages.some((each) => each.id === message.id)) {
    return shown;
  }
  return { ...shown, messages: [...shown.messages, message] };
}

export { newestSince, received, withNewest };
