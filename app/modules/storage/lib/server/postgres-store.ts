import type { Redacted, Scope } from "effect";
import { Effect } from "effect";
import type { FullStorage } from "./memory-store.ts";
import { StorageUnavailable } from "./errors.ts";
import { migratePostgres } from "./postgres-migrations.ts";
import { openPostgres } from "./adapters/postgres.ts";
import { sqlHealth } from "./health.ts";
import { sqlIdentities } from "./identities.ts";
import { sqlIdentityDeletes } from "./identity-owners.ts";
import { sqlMessageSections } from "./sql-message-sections.ts";

const notOnPostgresYet = StorageUnavailable.make({ message: "This part of the store is not on Postgres yet." });

function notYet(): Effect.Effect<never, StorageUnavailable> {
  return Effect.fail(notOnPostgresYet);
}

const notYetEffect: Effect.Effect<never, StorageUnavailable> = Effect.fail(notOnPostgresYet);

type PostgresSections = ReturnType<typeof sqlHealth> &
  ReturnType<typeof sqlIdentities> &
  ReturnType<typeof sqlIdentityDeletes> &
  ReturnType<typeof sqlMessageSections>;

type MissingSections = Omit<FullStorage, keyof PostgresSections>;

const missingSections: MissingSections = {
  addAgentJoinRequest: notYet,
  addCommand: notYet,
  addCommandToken: notYet,
  addDelivery: notYet,
  addJoinCode: notYet,
  addLoginRequest: notYet,
  appendCommandCall: notYet,
  approveAgentJoinRequest: notYet,
  approveLoginRequest: notYet,
  collectAgentJoinRequest: notYet,
  collectLoginRequest: notYet,
  deactivateQuietAgents: notYet,
  findAgentJoinRequest: notYet,
  findCommand: notYet,
  findCommandToken: notYet,
  findLiveAgentSession: notYet,
  findLoginCredential: notYet,
  findLoginRequest: notYet,
  issueAgentSession: notYet,
  keepDeactivationOffer: notYet,
  keepDeactivationOffersUpTo: notYet,
  lastActivityOf: notYet,
  listCommands: notYetEffect,
  listDeactivatedQuietAgents: notYet,
  listDeactivationOffers: notYet,
  listNudges: notYet,
  listOfflineAlerts: notYet,
  listPendingDeliveries: notYetEffect,
  listPresence: notYet,
  markBackOnline: notYet,
  markDeactivatedQuietAgentRead: notYet,
  markDeactivatedQuietAgentsReadUpTo: notYet,
  markNudgeRead: notYet,
  markNudgesReadUpTo: notYet,
  markOfflineAlertRead: notYet,
  markOfflineAlertsRead: notYet,
  nextDeactivationOfferDue: notYet,
  nextNudgeDue: notYet,
  raiseDueDeactivationOffers: notYet,
  raiseDueNudges: notYet,
  readDeactivatedQuietAgentsOf: notYet,
  recordActivity: notYet,
  recordOfflineAlert: notYet,
  recordPresence: notYet,
  redeemJoinCode: notYet,
  replaceCommandSecret: notYet,
  revokeAgentSession: notYet,
  revokeLiveAgentSession: notYet,
  revokeLoginCredential: notYet,
  searchMessages: notYet,
  updateDelivery: notYet,
  useAgentSession: notYet,
};

function openPostgresStore(url: Redacted.Redacted): Effect.Effect<FullStorage, StorageUnavailable, Scope.Scope> {
  return Effect.gen(function* openStore() {
    const db = yield* openPostgres(url);
    yield* migratePostgres(db);
    return {
      ...missingSections,
      ...sqlHealth(db),
      ...sqlIdentities(db),
      ...sqlIdentityDeletes(db),
      ...sqlMessageSections(db),
    };
  });
}

export { openPostgresStore };
