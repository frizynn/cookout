import type {
  AckResponse,
  FollowResponse,
  InboxHistoryQuery,
  InboxHistoryResponse,
  InboxResponse,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../inbox/index.ts";
import {
  ackPath,
  followPath,
  inboxHistoryPath,
  inboxPath,
  readPositionsPath,
  subscriptionPath,
} from "../../inbox/index.ts";
import {
  isAckResponse,
  isFollowResponse,
  isInboxHistoryResponse,
  isInboxResponse,
  isReadPositionsResponse,
  isSubscriptionResponse,
} from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import type { MessageId } from "../../messages/index.ts";
import { send } from "./request.ts";

type Change = "PUT" | "DELETE";

interface InboxCalls {
  readonly inbox: () => Promise<InboxResponse>;
  readonly inboxHistory: (query?: InboxHistoryQuery) => Promise<InboxHistoryResponse>;
  readonly readPositions: () => Promise<ReadPositionsResponse>;
  readonly ack: (messageId: MessageId) => Promise<AckResponse>;
  readonly follow: (messageId: MessageId) => Promise<FollowResponse>;
  readonly unfollow: (messageId: MessageId) => Promise<FollowResponse>;
  readonly subscribe: (channel: string) => Promise<SubscriptionResponse>;
  readonly unsubscribe: (channel: string) => Promise<SubscriptionResponse>;
}

function followCall(server: ClientConnection, method: Change) {
  return async (messageId: MessageId): Promise<FollowResponse> => {
    const params = { id: String(messageId) };
    const answer = await send(server, { isExpected: isFollowResponse, method, params, path: followPath });
    return answer;
  };
}

function subscriptionCall(server: ClientConnection, method: Change) {
  return async (channel: string): Promise<SubscriptionResponse> => {
    const params = { name: channel };
    const answer = await send(server, { isExpected: isSubscriptionResponse, method, params, path: subscriptionPath });
    return answer;
  };
}

function inboxCalls(server: ClientConnection): InboxCalls {
  return {
    ack: async (messageId) => {
      const body = { messageId };
      const acked = await send(server, { body, isExpected: isAckResponse, method: "POST", path: ackPath });
      return acked;
    },
    follow: followCall(server, "PUT"),
    inbox: async () => {
      const answer = await send(server, { isExpected: isInboxResponse, method: "GET", path: inboxPath });
      return answer;
    },
    inboxHistory: async ({ before, limit } = {}) => {
      const query = { before, limit };
      const page = await send(server, {
        isExpected: isInboxHistoryResponse,
        method: "GET",
        path: inboxHistoryPath,
        query,
      });
      return page;
    },
    readPositions: async () => {
      const answer = await send(server, {
        isExpected: isReadPositionsResponse,
        method: "GET",
        path: readPositionsPath,
      });
      return answer;
    },
    subscribe: subscriptionCall(server, "PUT"),
    unfollow: followCall(server, "DELETE"),
    unsubscribe: subscriptionCall(server, "DELETE"),
  };
}

export type {
  AckResponse,
  FollowResponse,
  InboxHistoryQuery,
  InboxHistoryResponse,
  InboxResponse,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../inbox/index.ts";
export { inboxCalls };
