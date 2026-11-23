import type { AgentJoinRequestsSection, JoinCodesSection } from "./agent-join-requests.ts";
import type { AgentSessionsSection } from "./agent-sessions.ts";
import type { ChannelsSection } from "./channels.ts";
import type { CommandCallsSection } from "./command-calls.ts";
import type { CommandsSection } from "./commands.ts";
import type { HealthSection } from "./health.ts";
import type { IdentitySections } from "./identity-section-types.ts";
import type { InboxSection } from "./inbox.ts";
import type { MessagesSection } from "./messages.ts";
import type { ReactionsSection } from "./reactions.ts";

export type StorageService = HealthSection &
  IdentitySections &
  ChannelsSection &
  MessagesSection &
  InboxSection &
  ReactionsSection &
  AgentSessionsSection &
  CommandsSection &
  CommandCallsSection &
  AgentJoinRequestsSection &
  JoinCodesSection;
