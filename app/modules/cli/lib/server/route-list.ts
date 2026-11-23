import { addressLimitLayer, limitsLayer } from "../../../limits/server.ts";
import {
  agentSessionOwnerRoutes,
  agentSessionRoutes,
  agentSessionsLayer,
  joinRequestRoutes,
  openJoinRequestRoutes,
} from "../../../agent-sessions/server.ts";
import { channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { commandChangesLayer, commandRoutes, commandsLayer } from "../../../commands/server.ts";
import {
  deactivationRoutes,
  deletionRoutes,
  descriptionRoutes,
  displayNameRoutes,
  displayNamesLayer,
  identitiesLayer,
  identityChangesLayer,
  identityRoutes,
  openIdentityRoutes,
  transferRoutes,
} from "../../../identities/server.ts";
import { inboxLayer, inboxRoutes } from "../../../inbox/server.ts";
import { liveRoutes, presenceLayer } from "./live-routes.ts";
import { messageRoutes, messagesLayer, reactionsLayer, readReceiptsLayer } from "../../../messages/server.ts";
import { Layer } from "effect";
import type { Route } from "../../../http/server.ts";

type NeedsOf<Routes> = Routes extends readonly Route<infer Needs>[] ? Needs : never;

type RouteNeeds =
  | NeedsOf<typeof identityRoutes>
  | NeedsOf<typeof displayNameRoutes>
  | NeedsOf<typeof descriptionRoutes>
  | NeedsOf<typeof agentSessionOwnerRoutes>
  | NeedsOf<typeof channelRoutes>
  | NeedsOf<typeof messageRoutes>
  | NeedsOf<typeof agentSessionRoutes>
  | NeedsOf<typeof inboxRoutes>
  | NeedsOf<typeof liveRoutes>
  | NeedsOf<typeof commandRoutes>;

type OpenNeeds = NeedsOf<typeof openIdentityRoutes> | NeedsOf<typeof openJoinRequestRoutes>;

export const routes: readonly Route<RouteNeeds>[] = [
  ...identityRoutes,
  ...displayNameRoutes,
  ...descriptionRoutes,
  ...transferRoutes,
  ...deactivationRoutes,
  ...deletionRoutes,
  ...channelRoutes,
  ...messageRoutes,
  ...agentSessionRoutes,
  ...agentSessionOwnerRoutes,
  ...joinRequestRoutes,
  ...inboxRoutes,
  ...liveRoutes,
  ...commandRoutes,
];

export const openRoutes: readonly Route<OpenNeeds>[] = [...openIdentityRoutes, ...openJoinRequestRoutes];

export const domainLayers = Layer.mergeAll(
  identitiesLayer,
  displayNamesLayer,
  channelsLayer,
  messagesLayer,
  agentSessionsLayer,
  inboxLayer,
  commandsLayer,
  limitsLayer,
  addressLimitLayer,
  presenceLayer,
).pipe(
  Layer.provideMerge(Layer.mergeAll(identityChangesLayer, commandChangesLayer, readReceiptsLayer, reactionsLayer)),
);
