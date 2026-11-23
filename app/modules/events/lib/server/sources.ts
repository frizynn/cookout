import { allChannels, channels } from "./all-channels.ts";
import type { AllChannelsNeeds } from "./all-channels.ts";
import type { EventSource } from "./source.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { Inbox } from "../../../inbox/server.ts";
import { connected } from "./connected.ts";
import { heartbeat } from "./source.ts";
import { identities } from "./identities.ts";
import { inboxItems } from "./inbox-items.ts";
import { readPositions } from "./read-positions.ts";

type SourceNeeds = Inbox | AllChannelsNeeds | IdentityChanges;

const sources: readonly EventSource<SourceNeeds>[] = [
  connected,
  inboxItems,
  readPositions,
  allChannels,
  identities,
  channels,
  heartbeat,
];

export { type SourceNeeds, sources };
