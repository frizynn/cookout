import type { ChannelsSection } from "./channels.ts";
import type { CommandCallsSection } from "./command-calls.ts";
import type { CommandsSection } from "./commands.ts";
import type { HealthSection } from "./health.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { InboxSection } from "./inbox.ts";
import type { LeasesSection } from "./leases.ts";
import type { LoginRequestsSection } from "./login-requests.ts";
import type { MessagesSection } from "./messages.ts";

export type StorageService = HealthSection &
  IdentitiesSection &
  ChannelsSection &
  MessagesSection &
  InboxSection &
  LeasesSection &
  CommandsSection &
  CommandCallsSection &
  LoginRequestsSection;
