import type { Redacted, Scope } from "effect";
import { Effect } from "effect";
import type { FullStorage } from "./memory-store.ts";
import { StorageUnavailable } from "./errors.ts";
import { migratePostgres } from "./postgres-migrations.ts";
import { openPostgres } from "./adapters/postgres.ts";
import { sqlHealth } from "./health.ts";
import { sqlIdentities } from "./identities.ts";

const notOnPostgresYet = StorageUnavailable.make({ message: "This part of the store is not on Postgres yet." });

function notYet(): Effect.Effect<never, StorageUnavailable> {
  return Effect.fail(notOnPostgresYet);
}

const notYetEffect: Effect.Effect<never, StorageUnavailable> = Effect.fail(notOnPostgresYet);

type MissingSections = Omit<FullStorage, keyof ReturnType<typeof sqlHealth> | keyof ReturnType<typeof sqlIdentities>>;

const missingSections: MissingSections = {
  ackInbox: notYet,
  ackMessage: notYet,
  addAgentJoinRequest: notYet,
  addCommand: notYet,
  addCommandToken: notYet,
  addDelivery: notYet,
  addJoinCode: notYet,
  addLoginRequest: notYet,
  addReaction: notYet,
  appendCommandCall: notYet,
  appendMessage: notYet,
  approveAgentJoinRequest: notYet,
  approveLoginRequest: notYet,
  closeThread: notYet,
  collectAgentJoinRequest: notYet,
  collectLoginRequest: notYet,
  countMessagesBy: notYet,
  createChannel: notYet,
  deactivateQuietAgents: notYet,
  deleteChannel: notYet,
  deleteIdentity: notYet,
  findAgentJoinRequest: notYet,
  findChannel: notYet,
  findCommand: notYet,
  findCommandToken: notYet,
  findInboxItem: notYet,
  findLiveAgentSession: notYet,
  findLoginCredential: notYet,
  findLoginRequest: notYet,
  followThread: notYet,
  getThread: notYet,
  issueAgentSession: notYet,
  keepDeactivationOffer: notYet,
  keepDeactivationOffersUpTo: notYet,
  lastActivityOf: notYet,
  latestMessageId: notYetEffect,
  listChannelMessages: notYet,
  listChannels: notYet,
  listCommands: notYetEffect,
  listDeactivatedQuietAgents: notYet,
  listDeactivationOffers: notYet,
  listInbox: notYet,
  listInboxAfter: notYet,
  listInboxHistory: notYet,
  listNudges: notYet,
  listOfflineAlerts: notYet,
  listOpenThreads: notYet,
  listPendingDeliveries: notYetEffect,
  listPresence: notYet,
  listReactions: notYet,
  listReadPositions: notYet,
  listReadReceipts: notYet,
  listSubscribedChannels: notYet,
  listUnseenReactions: notYet,
  markBackOnline: notYet,
  markDeactivatedQuietAgentRead: notYet,
  markDeactivatedQuietAgentsReadUpTo: notYet,
  markNudgeRead: notYet,
  markNudgesReadUpTo: notYet,
  markOfflineAlertRead: notYet,
  markOfflineAlertsRead: notYet,
  markReactionsSeen: notYet,
  moveReadPositionBack: notYet,
  nextDeactivationOfferDue: notYet,
  nextNudgeDue: notYet,
  raiseDueDeactivationOffers: notYet,
  raiseDueNudges: notYet,
  readDeactivatedQuietAgentsOf: notYet,
  recordActivity: notYet,
  recordOfflineAlert: notYet,
  recordPresence: notYet,
  redeemJoinCode: notYet,
  removeReaction: notYet,
  reopenThread: notYet,
  replaceCommandSecret: notYet,
  revokeAgentSession: notYet,
  revokeLiveAgentSession: notYet,
  revokeLoginCredential: notYet,
  searchMessages: notYet,
  subscribeChannel: notYet,
  unfollowThread: notYet,
  unsubscribeChannel: notYet,
  updateDelivery: notYet,
  useAgentSession: notYet,
};

function openPostgresStore(url: Redacted.Redacted): Effect.Effect<FullStorage, StorageUnavailable, Scope.Scope> {
  return Effect.gen(function* openStore() {
    const db = yield* openPostgres(url);
    yield* migratePostgres(db);
    return { ...missingSections, ...sqlHealth(db), ...sqlIdentities(db) };
  });
}

export { openPostgresStore };
