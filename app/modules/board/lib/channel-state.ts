import type {
  ChannelName,
  CookoutClient,
  Message,
  MessageId,
  ReadPosition,
  ReadReceipt,
  TopLevelMessage,
} from "../../sdk/index.ts";
import type { Failure, PostState } from "./failure.ts";
import type { CallState } from "./command-call.ts";

type OlderState = { readonly status: "idle" } | { readonly status: "loading" } | Failure;

type ReadState =
  | { readonly status: "none" }
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

interface Loaded {
  readonly status: "loaded";
  readonly messages: readonly TopLevelMessage[];
  readonly hasMore: boolean;
  readonly receipts: readonly ReadReceipt[];
  readonly older: OlderState;
  readonly read: ReadState;
  readonly call: CallState;
  readonly callData: string;
  readonly post: PostState;
  readonly expanded: ReadonlyMap<MessageId, number>;
}

type ChannelMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ChannelMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ChannelMessagesState;
  readonly loadOlder: () => void;
  readonly call: (command: string, data: string, called: () => void) => void;
  readonly editCallData: (data: string) => void;
  readonly post: (text: string, posted: () => void) => void;
  readonly showClosed: (run: readonly MessageId[], count: number) => void;
}

interface LiveChannelMessages extends ChannelMessages {
  readonly receive: (message: Message) => void;
  readonly receiveReceipt: (receipt: ReadReceipt) => void;
  readonly receiveThread: (parent: TopLevelMessage) => void;
  readonly refetch: () => void;
}

type MessagesClient = Pick<CookoutClient, "ack" | "callCommand" | "createMessage" | "listMessages">;

interface Channel {
  readonly client: MessagesClient;
  readonly name: ChannelName;
  readonly pageSize: number;
  readonly current: () => ChannelMessagesState;
  readonly open: () => boolean;
  readonly publish: (state: ChannelMessagesState) => void;
}

export {
  type Channel,
  type ChannelMessages,
  type ChannelMessagesState,
  type LiveChannelMessages,
  type Loaded,
  type MessagesClient,
};
