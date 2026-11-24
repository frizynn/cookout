/**
 * The calls a client makes to close and reopen a thread (#216), to list open threads (#219) and to search messages
 * (#320), and the answers they share. The SDK's `CookoutClient` has them.
 */
import type { ListOpenThreadsResponse, MessageId, TopLevelMessageResponse } from "./index.ts";
import type { SearchResponse } from "../search/index.ts";

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

/** The name of the search route's query parameter that holds the query as typed. */
export const searchQueryParam = "q";

/** A search: the query as typed, and which page of its results. */
export interface SearchRequest {
  /**
   * The query as typed. Each word matches a word that equals it or starts with it; every word must match. The
   * `from:@name`, `in:#channel`, `before:YYYY-MM-DD` and `after:YYYY-MM-DD` filters narrow it, `@` and `#` optional.
   */
  readonly query: string;
  /** Only results after this point: pass the previous page's `cursor` to read on. */
  readonly cursor?: string;
  /** 1–200 results. Default 50. */
  readonly limit?: number;
}

/** Searching messages. */
export interface SearchCalls {
  /**
   * `GET /v1/search?q=<query>`: a page of the messages and replies in every channel whose text matches the query,
   * newest first, Closed threads included, each with whether its thread is Closed. Pass the answer's `cursor` to read
   * the next page. A query with neither words nor filters is 400 `empty_query`; a filter naming no identity, no channel
   * or no real day is 400 `unknown_identity`, `unknown_channel` or `invalid_date`; a command token is 403
   * `outside_command_thread`.
   */
  readonly search: (request: SearchRequest) => Promise<SearchResponse>;
}
