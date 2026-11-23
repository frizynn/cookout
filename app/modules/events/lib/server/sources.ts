import type { Inbox, OfflineAlerts } from "../../../inbox/server.ts";
import { allChannels, channels, reactions, readReceipts, threads } from "./all-channels.ts";
import { connected, presence } from "./connected.ts";
import { identities, identityDeletions } from "./identities.ts";
import { inboxItems, reactionItems } from "./inbox-items.ts";
import { offlineAlerts, subscriptions } from "./subscriptions.ts";
import type { AllChannelsNeeds } from "./all-channels.ts";
import type { BoardChangesNeeds } from "./board-changes.ts";
import type { EventSource } from "./source.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { LiveConnectionNeeds } from "./connected.ts";
import { boardChanges } from "./board-changes.ts";
import { heartbeat } from "./source.ts";
import { readPositions } from "./read-positions.ts";

type SourceNeeds = Inbox | OfflineAlerts | AllChannelsNeeds | IdentityChanges | BoardChangesNeeds | LiveConnectionNeeds;

const sources: readonly EventSource<SourceNeeds>[] = [
  connected,
  inboxItems,
  reactionItems,
  readPositions,
  subscriptions,
  offlineAlerts,
  allChannels,
  threads,
  identities,
  identityDeletions,
  channels,
  ...boardChanges,
  readReceipts,
  reactions,
  presence,
  heartbeat,
];

export { type SourceNeeds, sources };
