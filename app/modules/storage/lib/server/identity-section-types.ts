import type { IdentitiesSection } from "./identities.ts";
import type { LoginRequestsSection } from "./login-requests.ts";
import type { PresenceSection } from "./presence.ts";

export type IdentitySections = IdentitiesSection & LoginRequestsSection & PresenceSection;
