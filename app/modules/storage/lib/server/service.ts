import type { ChannelsSection } from "./channels.ts";
import type { HealthSection } from "./health.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { MessagesSection } from "./messages.ts";

export type StorageService = HealthSection & IdentitiesSection & ChannelsSection & MessagesSection;
