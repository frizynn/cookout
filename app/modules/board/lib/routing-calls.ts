import type {
  BoardLimits,
  ChannelRoutingResponse,
  SetChannelRoutingRequest,
  WakeOptions,
} from "../../channels/index.ts";
import type { ChannelName, CookoutClient, CookoutEvent, Refusal } from "../../sdk/index.ts";
import { refusedAs } from "./subscriptions-slice.ts";

type RoutingClient = Pick<CookoutClient, "boardLimits" | "setBoardLimits" | "setChannelRouting" | "wakeOptions">;

type Answer<Answered> = { readonly answer: Answered } | { readonly refusal: Refusal };

interface RoutingCalls {
  readonly setChannelRouting: (
    channel: ChannelName,
    request: SetChannelRoutingRequest,
  ) => Promise<Answer<ChannelRoutingResponse>>;
  readonly boardLimits: () => Promise<Answer<BoardLimits>>;
  readonly setBoardLimits: (limits: BoardLimits) => Promise<Answer<BoardLimits>>;
  readonly wakeOptions: () => Promise<Answer<WakeOptions>>;
}

interface RoutingOptions {
  readonly client: RoutingClient;
  readonly heard: (event: CookoutEvent) => void;
}

async function answered<Answered>(asked: () => Promise<Answered>): Promise<Answer<Answered>> {
  try {
    const answer = await asked();
    return { answer };
  } catch (error: unknown) {
    return { refusal: refusedAs(error) };
  }
}

function routingCalls({ client, heard }: RoutingOptions): RoutingCalls {
  return {
    boardLimits: async () => {
      const limits = await answered(async () => {
        const found = await client.boardLimits();
        return found.limits;
      });
      return limits;
    },
    setBoardLimits: async (wanted) => {
      const limits = await answered(async () => {
        const set = await client.setBoardLimits(wanted);
        return set.limits;
      });
      return limits;
    },
    setChannelRouting: async (channel, request) => {
      const set = await answered(async () => {
        const answer = await client.setChannelRouting(channel, request);
        heard({ channel: answer.channel, type: "channel" });
        return answer;
      });
      return set;
    },
    wakeOptions: async () => {
      const options = await answered(async () => {
        const found = await client.wakeOptions();
        return found.options;
      });
      return options;
    },
  };
}

export { type Answer, type RoutingCalls, type RoutingClient, routingCalls };
