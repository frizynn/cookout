import type {
  ListMessagesQuery,
  ListMessagesResponse,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  ThreadResponse,
} from "../../messages/index.ts";
import { channelMessagesPath, messagesPath, threadPath } from "../../messages/index.ts";
import { isListMessagesResponse, isMessageResponse, isThreadResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { send } from "./request.ts";

interface MessageCalls {
  readonly createMessage: (request: PostMessageRequest) => Promise<MessageResponse>;
  readonly listMessages: (channel: string, query?: ListMessagesQuery) => Promise<ListMessagesResponse>;
  readonly getThread: (messageId: MessageId) => Promise<ThreadResponse>;
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
  };
}

export { messageCalls };
