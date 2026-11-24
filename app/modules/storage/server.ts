/**
 * The cookout's storage: one `Storage` service, so operations that must be
 * atomic stay one method each, and Layers that pass the same contract
 * suite. Every method fails with `StorageUnavailable` when the store can't be used.
 */
import { Context, Layer } from "effect";
import type { FileSystem, Redacted } from "effect";
import type { FullStorage } from "./lib/server/memory-store.ts";
import { StorageUnavailable } from "./lib/server/errors.ts";
import { openMemoryStore } from "./lib/server/memory-store.ts";
import { openPostgresStore } from "./lib/server/postgres-store.ts";
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
export type { SearchPageRequest } from "./lib/server/search.ts";
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
 * @param path The SQLite file, created if missing.
 * @returns The store, failing with `StorageUnavailable` if it can't be opened.
 */
export function sqliteStorage(path: string): Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem> {
  return Layer.effect(Storage, openSqliteStore(path));
}

/**
 * Opens and migrates the Postgres database at `url` on a pool of eight
 * connections, and closes the pool when the Layer is released. TLS is used
 * when the URL asks for it (`sslmode=require`). Each transaction is
 * serializable and runs one at a time; one that loses a serialization or
 * deadlock conflict is retried with jittered backoff, and surfaces
 * `StorageUnavailable` once the retries run out, so its work must read no
 * clock and publish nothing. Migrations are Postgres's own list, applied
 * in order under an advisory lock so two processes starting together apply
 * each once; a database newer than the list fails with "Upgrade cookout".
 * Only health and the identity sections are on Postgres so far; the rest fail
 * with `StorageUnavailable`, and nothing selects this Layer at runtime yet.
 * @param url The database URL, kept redacted.
 * @returns The store, failing with `StorageUnavailable` if it can't be opened.
 */
export function postgresStorage(url: Redacted.Redacted): Layer.Layer<Storage, StorageUnavailable> {
  return Layer.effect(Storage, openPostgresStore(url));
}

/** A store held in this process only. Everything is lost when the Layer is released. */
export const memoryStorage: Layer.Layer<Storage> = Layer.effect(Storage, openMemoryStore);
