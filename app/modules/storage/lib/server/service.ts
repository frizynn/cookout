import type { HealthSection } from "./health.ts";
import type { IdentitiesSection } from "./identities.ts";

export type StorageService = HealthSection & IdentitiesSection;
