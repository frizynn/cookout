import { addressLimitLayer, limitsLayer } from "../../../limits/server.ts";
import { agentSessionOwnerRoutes, agentSessionRoutes, agentSessionsLayer } from "../../../agent-sessions/server.ts";
import { channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { commandRoutes, commandsLayer } from "../../../commands/server.ts";
import {
  deactivationRoutes,
  displayNameRoutes,
  displayNamesLayer,
  identitiesLayer,
  identityRoutes,
  transferRoutes,
} from "../../../identities/server.ts";
import { inboxLayer, inboxRoutes } from "../../../inbox/server.ts";
import { messageRoutes, messagesLayer } from "../../../messages/server.ts";
import { Layer } from "effect";
import type { Route } from "../../../http/server.ts";
import { eventRoutes } from "../../../events/server.ts";

type NeedsOf<Routes> = Routes extends readonly Route<infer Needs>[] ? Needs : never;

type RouteNeeds =
  | NeedsOf<typeof identityRoutes>
  | NeedsOf<typeof displayNameRoutes>
  | NeedsOf<typeof transferRoutes>
  | NeedsOf<typeof agentSessionOwnerRoutes>
  | NeedsOf<typeof channelRoutes>
  | NeedsOf<typeof messageRoutes>
  | NeedsOf<typeof agentSessionRoutes>
  | NeedsOf<typeof inboxRoutes>
  | NeedsOf<typeof eventRoutes>
  | NeedsOf<typeof commandRoutes>;

export const routes: readonly Route<RouteNeeds>[] = [
  ...identityRoutes,
  ...displayNameRoutes,
  ...transferRoutes,
  ...deactivationRoutes,
  ...channelRoutes,
  ...messageRoutes,
  ...agentSessionRoutes,
  ...agentSessionOwnerRoutes,
  ...inboxRoutes,
  ...eventRoutes,
  ...commandRoutes,
];

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
);
