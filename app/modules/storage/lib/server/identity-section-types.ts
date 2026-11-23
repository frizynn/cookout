import type { IdentitiesSection } from "./identities.ts";
import type { LoginRequestsSection } from "./login-requests.ts";
import type { OfflineAlertsSection } from "./offline-alerts.ts";
import type { PresenceSection } from "./presence.ts";

export type SectionsBesideIdentities = LoginRequestsSection & PresenceSection & OfflineAlertsSection;

export type IdentitySections = IdentitiesSection & SectionsBesideIdentities;
