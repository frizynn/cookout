import { z } from "zod";
import { channelNameSchema } from "./channels.ts";
import { identityNameSchema, ownerSchema } from "./identities.ts";

/**
 * Message IDs are one increasing sequence across the whole server. They are
 * the order of messages, the read-position markers and the SSE event IDs.
 */
export const messageIdSchema = z.number().int().positive();
export type MessageId = z.infer<typeof messageIdSchema>;

/** Plain text with @-mentions. */
export const messageTextSchema = z.string().min(1).max(40_000);

/** Who posted a message, as they were when they posted it. */
export const authorSchema = z.object({
  name: identityNameSchema,
  owner: ownerSchema.optional(),
});
export type Author = z.infer<typeof authorSchema>;

const messageFields = {
  id: messageIdSchema,
  channel: channelNameSchema,
  author: authorSchema,
  text: messageTextSchema,
  /** Any JSON value, for commands and agents to read. Absent when none was sent. */
  data: z.json().optional(),
  /** Names of the identities the text @-mentions. */
  mentions: z.array(identityNameSchema),
  /** ISO 8601 UTC. */
  createdAt: z.iso.datetime(),
};

/** A message posted straight into a channel. It may have a thread of replies. */
export const topLevelMessageSchema = z.object({
  ...messageFields,
  replyCount: z.number().int().nonnegative(),
  /** The newest reply in its thread, or `null` if it has none. */
  latestReplyId: messageIdSchema.nullable(),
});
export type TopLevelMessage = z.infer<typeof topLevelMessageSchema>;

/**
 * A reply in a thread. Threads are one level deep: `replyTo` is always the
 * top-level message, even when the reply was posted to another reply.
 */
export const replySchema = z.object({
  ...messageFields,
  replyTo: messageIdSchema,
});
export type Reply = z.infer<typeof replySchema>;

export const messageSchema = z.union([topLevelMessageSchema, replySchema]);
export type Message = z.infer<typeof messageSchema>;

/** `POST /v1/messages`: post a top-level message or a reply. */
export const messagesPath = "/v1/messages";

/** `GET /v1/channels/<name>/messages?before=<id>&limit=<n>`: a page of top-level messages. */
export function channelMessagesPath(channel: string): string {
  return `/v1/channels/${encodeURIComponent(channel)}/messages`;
}

/** `GET /v1/messages/<id>/thread`: the thread holding message `id`. */
export function threadPath(messageId: MessageId): string {
  return `${messagesPath}/${messageId}/thread`;
}

export const postMessageRequestSchema = z.object({
  channel: channelNameSchema,
  text: messageTextSchema,
  data: z.json().optional(),
  /** Reply to this message. A reply to a reply goes to the top-level message's thread. */
  replyTo: messageIdSchema.optional(),
});
export type PostMessageRequest = z.infer<typeof postMessageRequestSchema>;

export const messageResponseSchema = z.object({ message: messageSchema });
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const defaultPageSize = 50;
export const maxPageSize = 200;

/**
 * The query of a channel page. With no `before`, the page is the newest
 * messages; pass the first message's ID as `before` to read further back.
 */
export const listMessagesQuerySchema = z.object({
  before: z.coerce.number().pipe(messageIdSchema).optional(),
  limit: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
});
/** What a caller sends as the query (as strings on the wire). */
export type ListMessagesQuery = { before?: MessageId; limit?: number };

/** Top-level messages oldest first. `hasMore` says older ones remain before the first. */
export const listMessagesResponseSchema = z.object({
  messages: z.array(topLevelMessageSchema),
  hasMore: z.boolean(),
});
export type ListMessagesResponse = z.infer<typeof listMessagesResponseSchema>;

/** A top-level message and its replies, oldest first. */
export const threadResponseSchema = z.object({
  parent: topLevelMessageSchema,
  replies: z.array(replySchema),
});
export type ThreadResponse = z.infer<typeof threadResponseSchema>;
