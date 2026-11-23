import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
  TopLevelMessageResponse,
} from "../../messages/index.ts";
import { channelMessagesPath, closedPath, messagesPath, threadPath } from "../../messages/index.ts";
import {
  isListMessagesResponse,
  isMessageResponse,
  isThreadResponse,
  isTopLevelMessageResponse,
} from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { send } from "./request.ts";

interface MessageCalls {
  readonly createMessage: (request: PostMessageRequest) => Promise<MessageResponse>;
  readonly listMessages: (channel: string, query?: ListMessagesQuery) => Promise<ListMessagesResponse>;
  readonly getThread: (messageId: MessageId) => Promise<ThreadResponse>;
  readonly closeThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
  readonly reopenThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
}

function closedCall(server: ClientConnection, method: "PUT" | "DELETE") {
  return async (messageId: MessageId): Promise<TopLevelMessageResponse> => {
    const params = { id: String(messageId) };
    const answer = await send(server, { isExpected: isTopLevelMessageResponse, method, params, path: closedPath });
    return answer;
  };
}

function messageCalls(server: ClientConnection): MessageCalls {
  return {
    closeThread: closedCall(server, "PUT"),
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
    reopenThread: closedCall(server, "DELETE"),
  };
}

export type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
  TopLevelMessageResponse,
} from "../../messages/index.ts";
export { messageCalls };
