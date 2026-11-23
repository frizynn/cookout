import { allChannels, channels } from "./all-channels.ts";
import type { AllChannelsNeeds } from "./all-channels.ts";
import type { BoardChangesNeeds } from "./board-changes.ts";
import type { EventSource } from "./source.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { Inbox } from "../../../inbox/server.ts";
import { boardChanges } from "./board-changes.ts";
import { connected } from "./connected.ts";
import { heartbeat } from "./source.ts";
import { identities } from "./identities.ts";
import { inboxItems } from "./inbox-items.ts";
import { readPositions } from "./read-positions.ts";
import { subscriptions } from "./subscriptions.ts";

type SourceNeeds = Inbox | AllChannelsNeeds | IdentityChanges | BoardChangesNeeds;

const sources: readonly EventSource<SourceNeeds>[] = [
  connected,
  inboxItems,
  readPositions,
  subscriptions,
  allChannels,
  identities,
  channels,
  ...boardChanges,
  heartbeat,
];

export { type SourceNeeds, sources };
