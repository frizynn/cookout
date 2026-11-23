import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { IDENTITY_COLUMNS, IdentityRow, toIdentity } from "./identity-row.ts";
import type { Identity, IdentityName, Owner, TokenHash } from "../../../identities/index.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { unreadable } from "./errors.ts";

interface Deactivated {
  readonly status: "deactivated";
  readonly identity: Identity;
  readonly agents: readonly IdentityName[];
}

type DeactivateIdentityResult = Deactivated | { readonly status: "not_found" } | { readonly status: "last_admin" };

type ReactivateIdentityResult =
  | { readonly status: "reactivated"; readonly identity: Identity }
  | { readonly status: "not_found" }
  | { readonly status: "not_deactivated" }
  | { readonly status: "owner_deactivated"; readonly owner: Owner };

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

const SELECT_IDENTITY = `SELECT ${IDENTITY_COLUMNS} FROM identities WHERE name = ?`;

const SELECT_OWNED = "SELECT name FROM identities WHERE kind = 'agent' AND owner = ? ORDER BY name";

const COUNT_ACTIVE_ADMINS = "SELECT count(*) AS count FROM identities WHERE admin = 1 AND deactivated = 0";

const SWITCH_OFF = [
  "UPDATE identities SET deactivated = 1 WHERE name = ?",
  "UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0",
  "UPDATE agent_session_tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0",
  "DELETE FROM command_tokens WHERE handler_name = ?",
  "DELETE FROM login_credentials WHERE identity_name = ?",
  "DELETE FROM login_requests WHERE approved_by = ?",
] as const;

const OwnedRow = Schema.Struct({ name: Schema.String.pipe(Schema.refine(isIdentityName)) });

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

function ownerNameOf(identity: Identity): Option.Option<Owner> {
  if (identity.kind === "agent") {
    return Option.some(identity.owner);
  }
  return Option.none();
}

function reactivationRefusal(
  identity: Identity,
  owner: Option.Option<Identity>,
): Option.Option<ReactivateIdentityResult> {
  if (isActive(identity)) {
    return Option.some({ status: "not_deactivated" });
  }
  return Option.map(
    Option.filter(owner, (found) => !isActive(found)),
    (found) => ({ owner: found.name, status: "owner_deactivated" }),
  );
}

function deactivatedIn(identities: Map<IdentityName, Identity>, identity: Identity): Deactivated {
  const owned = Arr.filter(
    [...identities.values()],
    (found) => found.kind === "agent" && found.owner === identity.name,
  );
  for (const each of [identity, ...owned]) {
    identities.set(each.name, deactivated(each));
  }
  const agents = Arr.sort(
    Arr.map(owned, (found) => found.name),
    Str.Order,
  );
  return { agents, identity: deactivated(identity), status: "deactivated" };
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
    const result = deactivatedIn(identities, identity);
    for (const each of [identity.name, ...result.agents]) {
      revokeTokensOf(each);
    }
    return result;
  }
  function reactivateFound(identity: Identity, hash: TokenHash): ReactivateIdentityResult {
    const owner = Option.flatMap(ownerNameOf(identity), (name) => Option.fromUndefinedOr(identities.get(name)));
    return Option.getOrElse(reactivationRefusal(identity, owner), () => {
      const active = reactivated(identity);
      identities.set(identity.name, active);
      revokeTokensOf(identity.name);
      holdToken(identity.name, hash);
      return { identity: { ...active }, status: "reactivated" } as const;
    });
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

function ownedAgents(db: SqliteDatabase, name: IdentityName): Fails<readonly IdentityName[]> {
  return db.all(SELECT_OWNED, name).pipe(
    Effect.flatMap((rows) => Effect.forEach(rows, decodeWith(OwnedRow), { concurrency: 1 })),
    Effect.map(Arr.map((row) => row.name)),
  );
}

function switchOffRow(db: SqliteDatabase, name: IdentityName): Fails<void> {
  return Effect.forEach(SWITCH_OFF, (sql) => db.run(sql, name), { concurrency: 1, discard: true });
}

function sqliteDeactivate(db: SqliteDatabase, identity: Identity): Fails<DeactivateIdentityResult> {
  return Effect.gen(function* deactivateRow() {
    const { count } = yield* Effect.flatMap(db.get(COUNT_ACTIVE_ADMINS), decodeWith(CountRow));
    if (isLastActiveAdmin(identity, count)) {
      return { status: "last_admin" } as const;
    }
    const agents = yield* ownedAgents(db, identity.name);
    yield* Effect.forEach([identity.name, ...agents], (each) => switchOffRow(db, each), {
      concurrency: 1,
      discard: true,
    });
    return { agents, identity: deactivated(identity), status: "deactivated" } as const;
  });
}

function ownerRow(db: SqliteDatabase, identity: Identity): Fails<Option.Option<Identity>> {
  const finding = Option.map(ownerNameOf(identity), (name) => findRow(db, name));
  return Effect.map(Effect.transposeOption(finding), Option.flatten);
}

function sqliteReactivate(db: SqliteDatabase, { hash, identity }: Reactivating): Fails<ReactivateIdentityResult> {
  return Effect.gen(function* reactivateRow() {
    const owner = yield* ownerRow(db, identity);
    const refused = reactivationRefusal(identity, owner);
    if (Option.isSome(refused)) {
      return refused.value;
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
