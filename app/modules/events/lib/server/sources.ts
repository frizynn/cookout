import type { EventSource } from "./source.ts";
import type { Inbox } from "../../../inbox/server.ts";
import type { Messages } from "../../../messages/server.ts";
import { allChannels } from "./all-channels.ts";
import { connected } from "./connected.ts";
import { heartbeat } from "./source.ts";
import { inboxItems } from "./inbox-items.ts";
import { readPositions } from "./read-positions.ts";

type SourceNeeds = Inbox | Messages;

const sources: readonly EventSource<SourceNeeds>[] = [connected, inboxItems, readPositions, allChannels, heartbeat];

export { type SourceNeeds, sources };
