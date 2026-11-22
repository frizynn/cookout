/**
 * Messages and threads on the wire, shared by the server, the SDK and the web:
 * the `MessageId` brand and its check, `Message` as a union tagged by `kind`,
 * the requests and answers of posting, threads and channel pages, their
 * paths, and the error codes they refuse with.
 */
import type { IdentityName, Owner } from "../identities/index.ts";
import type { ChannelName } from "../channels/index.ts";
import type { IsoTime } from "../time/index.ts";

declare const brand: unique symbol;

const LOWEST_ID = 1;

/**
 * A message's ID: a positive whole number. Message IDs are one increasing
 * sequence across the whole server, so they order messages.
 */
export type MessageId = number & { readonly [brand]: "MessageId" };

/**
 * Whether `value` is a positive whole number; if so, it is a `MessageId`.
 * @param value The number to check.
 * @returns Whether `value` is a `MessageId`.
 */
export function isMessageId(value: number): value is MessageId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

/** The text rule, in UTF-16 code units as `String.length` counts them. */
export const messageTextLength = { maximum: 40_000, minimum: 1 } as const;

/** Any JSON value. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Who posted a message, as they were when they posted it, so it survives the identity being deleted. */
export interface Author {
  readonly name: IdentityName;
  readonly owner?: Owner;
}

/** The fields every message has, top-level or reply. */
export interface MessageFields {
  readonly id: MessageId;
  readonly channel: ChannelName;
  readonly author: Author;
  /** Plain text, 1–40,000 characters. */
  readonly text: string;
  /** Any JSON value, for commands and agents to read. Absent when none was sent. */
  readonly data?: JsonValue;
  /** Names of the identities the text mentions. */
  readonly mentions: readonly IdentityName[];
  readonly createdAt: IsoTime;
}

/** A message posted straight into a channel. It may have a thread of replies. */
export interface TopLevelMessage extends MessageFields {
  readonly kind: "top-level";
  readonly replyCount: number;
  /** The newest reply in its thread, or `null` if it has none. */
  readonly latestReplyId: MessageId | null;
}

/** A reply in a thread. `replyTo` is always the top-level message, even when the reply was posted to another reply. */
export interface Reply extends MessageFields {
  readonly kind: "reply";
  readonly replyTo: MessageId;
}

/** A message, tagged by `kind`. */
export type Message = TopLevelMessage | Reply;

/** The body of `POST /v1/messages`. The server checks every field. */
export interface PostMessageRequest {
  readonly channel: string;
  readonly text: string;
  readonly data?: JsonValue;
  /** Reply to this message. A reply to a reply goes to the top-level message's thread. */
  readonly replyTo?: number;
}

/** The answer to posting a message. */
export interface MessageResponse {
  readonly message: Message;
}

/** The query of a channel page. With no `before`, the page is the newest messages. */
export interface ListMessagesQuery {
  /** Only messages before this message ID: pass the first message's ID to read further back. */
  readonly before?: number;
  /** 1–200 messages. Default 50. */
  readonly limit?: number;
}

/** A page of a channel's top-level messages, oldest first. `hasMore` says older ones remain before the first. */
export interface ListMessagesResponse {
  readonly messages: readonly TopLevelMessage[];
  readonly hasMore: boolean;
}

/** A top-level message and its replies, oldest first. */
export interface ThreadResponse {
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
}

/** The size of a channel page: 50 unless the query says otherwise, and never more than 200. */
export const pageSize = { default: 50, maximum: 200, minimum: 1 } as const;

/** `POST /v1/messages`: posts a top-level message or a reply. */
export const messagesPath = "/v1/messages";

/** `GET /v1/channels/:name/messages?before=<id>&limit=<n>`: a page of the channel's top-level messages. */
export const channelMessagesPath = "/v1/channels/:name/messages";

/** `GET /v1/messages/:id/thread`: the thread holding the message. */
export const threadPath = "/v1/messages/:id/thread";

/** The codes the message routes refuse with: a missing message (404) and a reply in another channel (400). */
export const messageErrorCodes = ["message_not_found", "reply_in_other_channel"] as const;
