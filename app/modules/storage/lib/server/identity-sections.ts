import { memoryIdentities, sqliteIdentities } from "./identities.ts";
import { memoryPresence, sqlitePresence } from "./presence.ts";
import { Effect } from "effect";
import type { IdentitySections } from "./identity-section-types.ts";
import type { LoginRequestsSection } from "./login-requests.ts";
import type { MemoryState } from "./memory-state.ts";
import type { PresenceSection } from "./presence.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { memoryLoginRequests } from "./login-requests-memory.ts";
import { sqliteIdentityDeletes } from "./identity-owners.ts";
import { sqliteLoginRequests } from "./login-requests-sqlite.ts";

type MemoryIdentitySections = ReturnType<typeof memoryIdentities> & LoginRequestsSection & PresenceSection;

function memoryIdentitySections(state: MemoryState): MemoryIdentitySections {
  const identities = memoryIdentities(state);
  const { dropLoginCredentials, ...loginRequests } = memoryLoginRequests({
    findIdentity: identities.findIdentity,
    state,
  });
  const { dropPresence, ...presence } = memoryPresence(state);
  return {
    ...identities,
    ...loginRequests,
    ...presence,
    deactivateIdentity: (name) =>
      Effect.tap(identities.deactivateIdentity(name), ({ status }) =>
        Effect.when(dropLoginCredentials(name), Effect.succeed(status === "deactivated")),
      ),
    removeIdentity: (name, messages) =>
      Effect.tap(identities.removeIdentity(name, messages), ({ status }) =>
        Effect.when(
          Effect.andThen(dropLoginCredentials(name), dropPresence(name)),
          Effect.succeed(status === "deleted"),
        ),
      ),
  };
}

function sqliteIdentitySections(db: SqliteDatabase): IdentitySections {
  return { ...sqliteIdentities(db), ...sqliteIdentityDeletes(db), ...sqliteLoginRequests(db), ...sqlitePresence(db) };
}

export { memoryIdentityLifecycle } from "./identity-lifecycle-memory.ts";

export { memoryIdentitySections, sqliteIdentitySections };
