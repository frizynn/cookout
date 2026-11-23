import { Array as Arr, Effect, Option, Schema } from "effect";
import { IDENTITY_COLUMNS, IdentityRow, toIdentity } from "./identity-row.ts";
import type { Identity, IdentityName, TokenHash } from "../../../identities/index.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

interface Deactivated {
  readonly status: "deactivated";
  readonly identity: Identity;
}

type DeactivateIdentityResult = Deactivated | { readonly status: "not_found" } | { readonly status: "last_admin" };

type ReactivateIdentityResult =
  | { readonly status: "reactivated"; readonly identity: Identity }
  | { readonly status: "not_found" }
  | { readonly status: "not_deactivated" };

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface DeactivationsSection {
  readonly deactivateIdentity: (name: IdentityName) => Fails<DeactivateIdentityResult>;
  readonly reactivateIdentity: (name: IdentityName, hash: TokenHash) => Fails<ReactivateIdentityResult>;
}

interface MemoryDeactivationsOptions {
  readonly identities: Map<IdentityName, Identity>;
  readonly revokeTokensOf: (name: IdentityName) => void;
  readonly holdToken: (name: IdentityName, hash: TokenHash) => void;
}

interface MemoryDeactivations {
  readonly deactivate: (name: IdentityName) => DeactivateIdentityResult;
  readonly reactivate: (name: IdentityName, hash: TokenHash) => ReactivateIdentityResult;
}

interface Reactivating {
  readonly identity: Identity;
  readonly hash: TokenHash;
}

const LAST_ADMIN_COUNT = 1;

const NOT_FOUND = { status: "not_found" } as const;

const NOT_DEACTIVATED = { status: "not_deactivated" } as const;

const SELECT_IDENTITY = `SELECT ${IDENTITY_COLUMNS} FROM identities WHERE name = ?`;

const COUNT_ACTIVE_ADMINS = "SELECT count(*) AS count FROM identities WHERE admin = 1 AND deactivated = 0";

const SWITCH_OFF = [
  "UPDATE identities SET deactivated = 1 WHERE name = ?",
  "UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0",
  "UPDATE agent_session_tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0",
  "DELETE FROM command_tokens WHERE handler_name = ?",
  "DELETE FROM login_credentials WHERE identity_name = ?",
  "DELETE FROM login_requests WHERE approved_by = ?",
] as const;

const CountRow = Schema.Struct({ count: Schema.Int });

function isActive(identity: Identity): boolean {
  return identity.deactivated !== true;
}

function isLastActiveAdmin(identity: Identity, activeAdmins: number): boolean {
  return identity.admin && isActive(identity) && activeAdmins <= LAST_ADMIN_COUNT;
}

function deactivated(identity: Identity): Identity {
  return { ...identity, deactivated: true };
}

function reactivated(identity: Identity): Identity {
  const { deactivated: _wasDeactivated, ...active } = identity;
  return active;
}

function memoryDeactivations({
  holdToken,
  identities,
  revokeTokensOf,
}: MemoryDeactivationsOptions): MemoryDeactivations {
  function deactivateFound(identity: Identity): DeactivateIdentityResult {
    const activeAdmins = Arr.filter([...identities.values()], (found) => found.admin && isActive(found)).length;
    if (isLastActiveAdmin(identity, activeAdmins)) {
      return { status: "last_admin" };
    }
    identities.set(identity.name, deactivated(identity));
    revokeTokensOf(identity.name);
    return { identity: deactivated(identity), status: "deactivated" };
  }
  function reactivateFound(identity: Identity, hash: TokenHash): ReactivateIdentityResult {
    if (isActive(identity)) {
      return NOT_DEACTIVATED;
    }
    const active = reactivated(identity);
    identities.set(identity.name, active);
    revokeTokensOf(identity.name);
    holdToken(identity.name, hash);
    return { identity: { ...active }, status: "reactivated" };
  }
  return {
    deactivate: (name) =>
      Option.match(Option.fromUndefinedOr(identities.get(name)), { onNone: () => NOT_FOUND, onSome: deactivateFound }),
    reactivate: (name, hash) =>
      Option.match(Option.fromUndefinedOr(identities.get(name)), {
        onNone: () => NOT_FOUND,
        onSome: (identity) => reactivateFound(identity, hash),
      }),
  };
}

function decodeWith<Decoder extends Schema.Decoder<unknown>>(
  schema: Decoder,
): (row: unknown) => Fails<Decoder["Type"]> {
  return (row) => Effect.mapError(Schema.decodeUnknownEffect(schema)(row), unreadable);
}

function findRow(db: SqliteDatabase, name: IdentityName): Fails<Option.Option<Identity>> {
  return Effect.flatMap(db.get(SELECT_IDENTITY, name), (row) =>
    Effect.transposeOption(
      Option.map(Option.fromUndefinedOr(row), (found) => Effect.map(decodeWith(IdentityRow)(found), toIdentity)),
    ),
  );
}

function sqliteDeactivate(db: SqliteDatabase, identity: Identity): Fails<DeactivateIdentityResult> {
  return Effect.gen(function* deactivateRow() {
    const { count } = yield* Effect.flatMap(db.get(COUNT_ACTIVE_ADMINS), decodeWith(CountRow));
    if (isLastActiveAdmin(identity, count)) {
      return { status: "last_admin" } as const;
    }
    yield* Effect.forEach(SWITCH_OFF, (sql) => db.run(sql, identity.name), { concurrency: 1, discard: true });
    return { identity: deactivated(identity), status: "deactivated" } as const;
  });
}

function sqliteReactivate(db: SqliteDatabase, { hash, identity }: Reactivating): Fails<ReactivateIdentityResult> {
  return Effect.gen(function* reactivateRow() {
    if (isActive(identity)) {
      return NOT_DEACTIVATED;
    }
    yield* db.run("UPDATE identities SET deactivated = 0 WHERE name = ?", identity.name);
    yield* db.run("UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0", identity.name);
    yield* db.run("INSERT INTO tokens (token_hash, identity_name, revoked) VALUES (?, ?, 0)", hash, identity.name);
    return { identity: reactivated(identity), status: "reactivated" } as const;
  });
}

function sqliteDeactivations(db: SqliteDatabase): DeactivationsSection {
  function onFound<Result>(
    name: IdentityName,
    work: (identity: Identity) => Fails<Result>,
  ): Fails<Result | typeof NOT_FOUND> {
    return db.transaction(
      Effect.flatMap(findRow(db, name), (found) =>
        Option.match(found, {
          onNone: (): Fails<Result | typeof NOT_FOUND> => Effect.succeed(NOT_FOUND),
          onSome: work,
        }),
      ),
    );
  }
  return {
    deactivateIdentity: (name) => onFound(name, (identity) => sqliteDeactivate(db, identity)),
    reactivateIdentity: (name, hash) => onFound(name, (identity) => sqliteReactivate(db, { hash, identity })),
  };
}

export { type DeactivateIdentityResult, type ReactivateIdentityResult, memoryDeactivations, sqliteDeactivations };
