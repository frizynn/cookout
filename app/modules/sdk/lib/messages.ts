import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ReactionName,
  ReactionsResponse,
  ThreadResponse,
} from "../../messages/index.ts";
import { channelMessagesPath, messagesPath, reactionPath, threadPath } from "../../messages/index.ts";
import {
  isListMessagesResponse,
  isMessageResponse,
  isReactionsResponse,
  isThreadResponse,
} from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { send } from "./request.ts";

interface MessageCalls {
  readonly createMessage: (request: PostMessageRequest) => Promise<MessageResponse>;
  readonly listMessages: (channel: string, query?: ListMessagesQuery) => Promise<ListMessagesResponse>;
  readonly getThread: (messageId: MessageId) => Promise<ThreadResponse>;
  readonly react: (messageId: MessageId, reaction: ReactionName) => Promise<ReactionsResponse>;
  readonly unreact: (messageId: MessageId, reaction: ReactionName) => Promise<ReactionsResponse>;
}

function reactionCall(server: ClientConnection, method: "PUT" | "DELETE") {
  return async (messageId: MessageId, reaction: ReactionName): Promise<ReactionsResponse> => {
    const params = { id: String(messageId), reaction };
    const answer = await send(server, { isExpected: isReactionsResponse, method, params, path: reactionPath });
    return answer;
  };
}

function messageCalls(server: ClientConnection): MessageCalls {
  return {
    createMessage: async (body) => {
      const posted = await send(server, { body, isExpected: isMessageResponse, method: "POST", path: messagesPath });
      return posted;
    },
    getThread: async (messageId) => {
      const params = { id: String(messageId) };
      const thread = await send(server, { isExpected: isThreadResponse, method: "GET", params, path: threadPath });
      return thread;
    },
    listMessages: async (channel, { before, limit } = {}) => {
      const page = await send(server, {
        isExpected: isListMessagesResponse,
        method: "GET",
        params: { name: channel },
        path: channelMessagesPath,
        query: { before, limit },
      });
      return page;
    },
    react: reactionCall(server, "PUT"),
    unreact: reactionCall(server, "DELETE"),
  };
}

export type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ReactionName,
  ReactionsResponse,
  ThreadResponse,
} from "../../messages/index.ts";
export { messageCalls };
