import { channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { commandRoutes, commandsLayer } from "../../../commands/server.ts";
import { displayNameRoutes, displayNamesLayer, identitiesLayer, identityRoutes } from "../../../identities/server.ts";
import { inboxLayer, inboxRoutes } from "../../../inbox/server.ts";
import { leaseRoutes, leasesLayer } from "../../../leases/server.ts";
import { messageRoutes, messagesLayer } from "../../../messages/server.ts";
import { Layer } from "effect";
import type { Route } from "../../../http/server.ts";
import { eventRoutes } from "../../../events/server.ts";
import { limitsLayer } from "../../../limits/server.ts";

type NeedsOf<Routes> = Routes extends readonly Route<infer Needs>[] ? Needs : never;

type RouteNeeds =
  | NeedsOf<typeof identityRoutes>
  | NeedsOf<typeof displayNameRoutes>
  | NeedsOf<typeof channelRoutes>
  | NeedsOf<typeof messageRoutes>
  | NeedsOf<typeof leaseRoutes>
  | NeedsOf<typeof inboxRoutes>
  | NeedsOf<typeof eventRoutes>
  | NeedsOf<typeof commandRoutes>;

export const routes: readonly Route<RouteNeeds>[] = [
  ...identityRoutes,
  ...displayNameRoutes,
  ...channelRoutes,
  ...messageRoutes,
  ...leaseRoutes,
  ...inboxRoutes,
  ...eventRoutes,
  ...commandRoutes,
];

export const domainLayers = Layer.mergeAll(
  identitiesLayer,
  displayNamesLayer,
  channelsLayer,
  messagesLayer,
  leasesLayer,
  inboxLayer,
  commandsLayer,
  limitsLayer,
);
