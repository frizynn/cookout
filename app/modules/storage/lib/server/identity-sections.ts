import { memoryIdentities, sqliteIdentities } from "./identities.ts";
import { Effect } from "effect";
import type { IdentitiesSection } from "./identities.ts";
import type { LoginRequestsSection } from "./login-requests.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { memoryLoginRequests } from "./login-requests-memory.ts";
import { sqliteLoginRequests } from "./login-requests-sqlite.ts";

type MemoryIdentitySections = ReturnType<typeof memoryIdentities> & LoginRequestsSection;

function memoryIdentitySections(state: MemoryState): MemoryIdentitySections {
  const identities = memoryIdentities(state);
  const { dropLoginCredentials, ...loginRequests } = memoryLoginRequests({
    findIdentity: identities.findIdentity,
    state,
  });
  return {
    ...identities,
    ...loginRequests,
    deleteIdentity: (name) =>
      Effect.tap(identities.deleteIdentity(name), ({ status }) =>
        Effect.when(dropLoginCredentials(name), Effect.succeed(status === "deleted")),
      ),
  };
}

function sqliteIdentitySections(db: SqliteDatabase): IdentitiesSection & LoginRequestsSection {
  return { ...sqliteIdentities(db), ...sqliteLoginRequests(db) };
}

export { memoryIdentitySections, sqliteIdentitySections };
