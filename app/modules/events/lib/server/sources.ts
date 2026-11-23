import { allChannels, channels, readReceipts } from "./all-channels.ts";
import { connected, presence } from "./connected.ts";
import { identities, identityDeletions } from "./identities.ts";
import type { AllChannelsNeeds } from "./all-channels.ts";
import type { BoardChangesNeeds } from "./board-changes.ts";
import type { EventSource } from "./source.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { Inbox } from "../../../inbox/server.ts";
import type { LiveConnectionNeeds } from "./connected.ts";
import { boardChanges } from "./board-changes.ts";
import { heartbeat } from "./source.ts";
import { inboxItems } from "./inbox-items.ts";
import { readPositions } from "./read-positions.ts";
import { subscriptions } from "./subscriptions.ts";

type SourceNeeds = Inbox | AllChannelsNeeds | IdentityChanges | BoardChangesNeeds | LiveConnectionNeeds;

const sources: readonly EventSource<SourceNeeds>[] = [
  connected,
  inboxItems,
  readPositions,
  subscriptions,
  allChannels,
  identities,
  identityDeletions,
  channels,
  ...boardChanges,
  readReceipts,
  presence,
  heartbeat,
];

export { type SourceNeeds, sources };
