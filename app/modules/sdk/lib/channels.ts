import type { ChannelResponse, CreateChannelRequest, ListChannelsResponse } from "../../channels/index.ts";
import { channelPath, channelsPath } from "../../channels/index.ts";
import { getJson, send } from "./request.ts";
import { isChannelResponse, isListChannelsResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";

interface ChannelCalls {
  readonly createChannel: (request: CreateChannelRequest) => Promise<ChannelResponse>;
  readonly listChannels: () => Promise<ListChannelsResponse>;
  readonly getChannel: (name: string) => Promise<ChannelResponse>;
  readonly deleteChannel: (name: string) => Promise<ChannelResponse>;
}

function channelCalls(server: ClientConnection): ChannelCalls {
  return {
    createChannel: async (body) => {
      const created = await send(server, { body, isExpected: isChannelResponse, method: "POST", path: channelsPath });
      return created;
    },
    deleteChannel: async (name) => {
      const deleted = await send(server, {
        isExpected: isChannelResponse,
        method: "DELETE",
        params: { name },
        path: channelPath,
      });
      return deleted;
    },
    getChannel: async (name) => {
      const found = await send(server, {
        isExpected: isChannelResponse,
        method: "GET",
        params: { name },
        path: channelPath,
      });
      return found;
    },
    listChannels: async () => {
      const listed = await getJson(server, channelsPath, isListChannelsResponse);
      return listed;
    },
  };
}

export type {
  Channel,
  ChannelName,
  ChannelResponse,
  CreateChannelRequest,
  ListChannelsResponse,
} from "../../channels/index.ts";
export { channelCalls };
