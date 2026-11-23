/**
 * The calls a client makes to close and reopen a thread (#216) and to list open threads (#219), and the answers they
 * share. The SDK's `CookoutClient` has them.
 */
import type { MessageId, TopLevelMessage, TopLevelMessageResponse } from "./index.ts";
import type { IsoTime } from "../time/index.ts";

/** Closing and reopening the thread holding a message. */
export interface ClosedThreadCalls {
  /**
   * `PUT /v1/messages/:id/closed`: closes the thread holding the message (any message in it) and answers its top-level
   * message, now with `closedAt` and `closedBy`. Any identity may close any thread; closing a closed one keeps its
   * first closer and time. Closing hides nothing from the API: the inbox, history and `watch` list it as before. A
   * missing message is 404 `message_not_found`.
   */
  readonly closeThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
  /**
   * `DELETE /v1/messages/:id/closed`: reopens the thread holding the message and answers its top-level message, now
   * without `closedAt` and `closedBy`. Reopening an open thread changes nothing; a reply in a closed thread reopens it
   * too. A missing message is 404 `message_not_found`.
   */
  readonly reopenThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
}

/** An open thread as Open threads lists it: its top-level message and when anything last happened in it. */
export interface OpenThread {
  readonly message: TopLevelMessage;
  /** Its latest message's time, or its last reopen's if that is later. */
  readonly lastActivityAt: IsoTime;
}

/** The query of an Open threads page. With no `cursor`, the page starts at the stalest open thread. */
export interface ListOpenThreadsQuery {
  /** Every open thread on the board, not only the ones involving the caller. */
  readonly all?: boolean;
  /** Only threads after this point: pass the previous page's `cursor` to read on. */
  readonly cursor?: string;
  /** 1–200 threads. Default 50. */
  readonly limit?: number;
}

/**
 * A page of open threads, stalest first by `lastActivityAt`, ties by ID. `hasMore` says more remain after the last;
 * `cursor` reads on from it, and is null on the last page.
 */
export interface ListOpenThreadsResponse {
  readonly threads: readonly OpenThread[];
  readonly hasMore: boolean;
  readonly cursor: string | null;
}

/**
 * `GET /v1/threads/open?all=true&cursor=<cursor>&limit=<n>`: a page of open threads. Without `all=true`, only the
 * threads involving the caller: it wrote the top-level message or a reply, or is mentioned in either.
 */
export const openThreadsPath = "/v1/threads/open";

/** Listing open threads. */
export interface OpenThreadCalls {
  /**
   * `GET /v1/threads/open`: a page of open threads, stalest first by last activity, ties by ID. Without `all`, only
   * the threads involving the caller; pass the answer's `cursor` to read the next page.
   */
  readonly listOpenThreads: (query?: ListOpenThreadsQuery) => Promise<ListOpenThreadsResponse>;
}
