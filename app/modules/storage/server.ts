/**
 * The cookout's storage: one `Storage` service, so operations that must be
 * atomic stay one method each, and two Layers that pass the same contract
 * suite. Every method fails with `StorageUnavailable` when the store can't be used.
 */
import { Context, Layer } from "effect";
import type { FileSystem } from "effect";
import type { FullStorage } from "./lib/server/memory-store.ts";
import { StorageUnavailable } from "./lib/server/errors.ts";
import { openMemoryStore } from "./lib/server/memory-store.ts";
import { openSqliteStore } from "./lib/server/sqlite-store.ts";

export { StorageUnavailable };
export type { TokenLookup } from "./lib/server/identities.ts";
export type { SetAdminResult } from "./lib/server/identity-admins.ts";
export type { DeactivateIdentityResult, ReactivateIdentityResult } from "./lib/server/identity-deactivations.ts";
export type { DeleteIdentityResult } from "./lib/server/identity-deletes.ts";
export type { StoredCommand } from "./lib/server/commands.ts";
export type { CommandTokenGrant } from "./lib/server/command-tokens.ts";
export type { DeliveryOutcome, StoredDelivery } from "./lib/server/deliveries.ts";
export type { NewMessage, StoredPage, StoredThread } from "./lib/server/messages.ts";
export type { OpenThreadsPageRequest } from "./lib/server/open-threads.ts";
export type { SearchCursor, SearchPageRequest } from "./lib/server/search.ts";
export type { AckedMessage } from "./lib/server/inbox.ts";
export type { StoredNudge } from "./lib/server/nudges.ts";
export type { OfferChanges, StoredDeactivationOffer } from "./lib/server/deactivation-offers.ts";
export type { StoredDeactivatedQuietAgent } from "./lib/server/deactivated-quiet-agents.ts";
export type { StoredPresence } from "./lib/server/presence.ts";
export type { NewCommandCall } from "./lib/server/command-calls.ts";
export type { JoinCodeRedemption } from "./lib/server/join-codes.ts";
export type { AgentAt, UseAgentSessionResult } from "./lib/server/agent-sessions.ts";
export type { TransferAgentResult } from "./lib/server/identity-admins.ts";
export type { LoginCollection, LoginRequest, NewLoginRequest } from "./lib/server/login-requests.ts";
export type {
  AgentJoinApproval,
  AgentJoinCollection,
  AgentJoinRequest,
} from "./lib/server/agent-join-requests.ts";

export class Storage extends Context.Service<Storage, FullStorage>()("@ai-hero/cookout/storage/server/Storage") {}

/**
 * Opens and migrates the SQLite file at `path`, and closes it when the Layer
 * is released. A new file is created readable by its owner only, and so are
 * its WAL and shared-memory files, since they hold token hashes and messages.
 */
export const sqliteStorage = (path: string): Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem> =>
  Layer.effect(Storage, openSqliteStore(path));

/** A store held in this process only. Everything is lost when the Layer is released. */
export const memoryStorage: Layer.Layer<Storage> = Layer.effect(Storage, openMemoryStore);
