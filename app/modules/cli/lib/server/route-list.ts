import { channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { identitiesLayer, identityRoutes } from "../../../identities/server.ts";
import { inboxLayer, inboxRoutes } from "../../../inbox/server.ts";
import { leaseRoutes, leasesLayer } from "../../../leases/server.ts";
import { messageRoutes, messagesLayer } from "../../../messages/server.ts";
import { Layer } from "effect";
import type { Route } from "../../../http/server.ts";
import { eventRoutes } from "../../../events/server.ts";

type NeedsOf<Routes> = Routes extends readonly Route<infer Needs>[] ? Needs : never;

type RouteNeeds =
  | NeedsOf<typeof identityRoutes>
  | NeedsOf<typeof channelRoutes>
  | NeedsOf<typeof messageRoutes>
  | NeedsOf<typeof leaseRoutes>
  | NeedsOf<typeof inboxRoutes>
  | NeedsOf<typeof eventRoutes>;

export const routes: readonly Route<RouteNeeds>[] = [
  ...identityRoutes,
  ...channelRoutes,
  ...messageRoutes,
  ...leaseRoutes,
  ...inboxRoutes,
  ...eventRoutes,
];

export const domainLayers = Layer.mergeAll(identitiesLayer, channelsLayer, messagesLayer, leasesLayer, inboxLayer);
