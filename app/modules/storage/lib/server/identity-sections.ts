import type { IdentitySections, SectionsBesideIdentities } from "./identity-section-types.ts";
import { memoryIdentities, sqliteIdentities } from "./identities.ts";
import { memoryOfflineAlerts, sqliteOfflineAlerts } from "./offline-alerts.ts";
import { memoryPresence, sqlitePresence } from "./presence.ts";
import { Effect } from "effect";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { memoryLoginRequests } from "./login-requests-memory.ts";
import { sqliteIdentityDeletes } from "./identity-owners.ts";
import { sqliteLoginRequests } from "./login-requests-sqlite.ts";

type MemoryIdentitySections = ReturnType<typeof memoryIdentities> & SectionsBesideIdentities;

function memoryIdentitySections(state: MemoryState): MemoryIdentitySections {
  const identities = memoryIdentities(state);
  const { dropLoginCredentials, ...loginRequests } = memoryLoginRequests({
    findIdentity: identities.findIdentity,
    state,
  });
  const { dropPresence, ...presence } = memoryPresence(state);
  const { dropOfflineAlerts, ...offlineAlerts } = memoryOfflineAlerts(state);
  return {
    ...identities,
    ...loginRequests,
    ...presence,
    ...offlineAlerts,
    deactivateIdentity: (name) =>
      Effect.tap(identities.deactivateIdentity(name), ({ status }) =>
        Effect.when(dropLoginCredentials(name), Effect.succeed(status === "deactivated")),
      ),
    removeIdentity: (name, messages) =>
      Effect.tap(identities.removeIdentity(name, messages), ({ status }) =>
        Effect.when(
          Effect.all([dropLoginCredentials(name), dropPresence(name), dropOfflineAlerts(name)], {
            concurrency: 1,
            discard: true,
          }),
          Effect.succeed(status === "deleted"),
        ),
      ),
  };
}

function sqliteIdentitySections(db: SqliteDatabase): IdentitySections {
  return {
    ...sqliteIdentities(db),
    ...sqliteIdentityDeletes(db),
    ...sqliteLoginRequests(db),
    ...sqlitePresence(db),
    ...sqliteOfflineAlerts(db),
  };
}

export { memoryIdentityLifecycle } from "./identity-lifecycle-memory.ts";

export { memoryIdentitySections, sqliteIdentitySections };
