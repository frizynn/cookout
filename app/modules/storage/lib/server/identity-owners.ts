import { Array as Arr, Effect, Option, Predicate, Schema, String as Str } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { IdentityRow, toIdentity } from "./identity-row.ts";
import { isIdentityName, nameFitsOwner } from "../../../identities/index.ts";
import { INBOX_TABLES } from "./inbox-sqlite.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

type CreateRefusal = "name_taken" | "name_not_owned" | "owner_not_human";

interface OwnsAgents {
  readonly status: "owns_agents";
  readonly agents: readonly IdentityName[];
}

type DeleteIdentityResult =
  | { readonly status: "deleted"; readonly identity: Identity }
  | { readonly status: "not_found" }
  | { readonly status: "last_admin" }
  | OwnsAgents;

interface Existing {
  readonly taken: boolean;
  readonly ownerIsHuman: boolean;
}

interface MemoryOwners {
  readonly identities: Map<IdentityName, Identity>;
  readonly revokeTokensOf: (name: IdentityName) => void;
}

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const NO_ROWS = 0;

const LAST_ADMIN_COUNT = 1;

const COUNT_EXISTING = `SELECT
  (SELECT count(*) FROM identities WHERE name = ?) AS taken,
  (SELECT count(*) FROM identities WHERE name = ? AND kind = 'human') AS owner_humans`;

const SELECT_OWNED = "SELECT name FROM identities WHERE kind = 'agent' AND owner = ? ORDER BY name";

const SELECT_IDENTITY = "SELECT name, kind, owner, admin, created_at, display_name FROM identities WHERE name = ?";

const COUNT_ADMINS = "SELECT count(*) AS count FROM identities WHERE admin = 1";

const ExistingRow = Schema.Struct({ owner_humans: Schema.Int, taken: Schema.Int });

const OwnedRow = Schema.Struct({ name: Schema.String.pipe(Schema.refine(isIdentityName)) });

const AdminCountRow = Schema.Struct({ count: Schema.Int });

function ownerOf(identity: Identity): IdentityName {
  if (identity.kind === "agent") {
    return identity.owner;
  }
  return identity.name;
}

function createRefusal(identity: Identity, { ownerIsHuman, taken }: Existing): Option.Option<CreateRefusal> {
  if (taken) {
    return Option.some("name_taken");
  }
  if (!nameFitsOwner(identity)) {
    return Option.some("name_not_owned");
  }
  if (identity.kind === "agent" && !ownerIsHuman) {
    return Option.some("owner_not_human");
  }
  return Option.none();
}

function ownsAgents(agents: readonly IdentityName[]): Option.Option<OwnsAgents> {
  if (Arr.isReadonlyArrayNonEmpty(agents)) {
    return Option.some({ agents, status: "owns_agents" });
  }
  return Option.none();
}

function deleteRefusal(
  identity: Identity,
  admins: number,
  owns: Option.Option<OwnsAgents>,
): Option.Option<DeleteIdentityResult> {
  if (identity.admin && admins === LAST_ADMIN_COUNT) {
    return Option.some({ status: "last_admin" });
  }
  return owns;
}

function memoryOwnsAgents(
  identities: ReadonlyMap<IdentityName, Identity>,
  name: IdentityName,
): Option.Option<OwnsAgents> {
  const owned = Arr.filter(
    Arr.fromIterable(identities.values()),
    (found) => found.kind === "agent" && found.owner === name,
  );
  return ownsAgents(
    Arr.sort(
      Arr.map(owned, (found) => found.name),
      Str.Order,
    ),
  );
}

function memoryCreateRefusal(
  identities: ReadonlyMap<IdentityName, Identity>,
): (identity: Identity) => Option.Option<CreateRefusal> {
  return (identity) => {
    const owner = Option.fromUndefinedOr(identities.get(ownerOf(identity)));
    return createRefusal(identity, {
      ownerIsHuman: Option.exists(owner, (found) => found.kind === "human"),
      taken: identities.has(identity.name),
    });
  };
}

function memoryDeleteIdentity({
  identities,
  revokeTokensOf,
}: MemoryOwners): (name: IdentityName) => DeleteIdentityResult {
  return (name) => {
    const identity = identities.get(name);
    if (Predicate.isUndefined(identity)) {
      return { status: "not_found" };
    }
    const admins = Arr.filter([...identities.values()], (found) => found.admin).length;
    const refused = deleteRefusal(identity, admins, memoryOwnsAgents(identities, name));
    if (Option.isSome(refused)) {
      return refused.value;
    }
    revokeTokensOf(name);
    identities.delete(name);
    return { identity: { ...identity }, status: "deleted" };
  };
}

function sqliteCreateRefusal(db: SqliteDatabase): (identity: Identity) => Fails<Option.Option<CreateRefusal>> {
  return (identity) =>
    db.get(COUNT_EXISTING, identity.name, ownerOf(identity)).pipe(
      Effect.flatMap((row) => Effect.mapError(Schema.decodeUnknownEffect(ExistingRow)(row), unreadable)),
      Effect.map((row) =>
        createRefusal(identity, { ownerIsHuman: row.owner_humans > NO_ROWS, taken: row.taken > NO_ROWS }),
      ),
    );
}

function sqliteOwnsAgents(db: SqliteDatabase, name: IdentityName): Fails<Option.Option<OwnsAgents>> {
  return db.all(SELECT_OWNED, name).pipe(
    Effect.flatMap((rows) =>
      Effect.forEach(rows, (row) => Effect.mapError(Schema.decodeUnknownEffect(OwnedRow)(row), unreadable), {
        concurrency: 1,
      }),
    ),
    Effect.map(Arr.map((row) => row.name)),
    Effect.map(ownsAgents),
  );
}

function countAdmins(db: SqliteDatabase): Fails<number> {
  return db.get(COUNT_ADMINS).pipe(
    Effect.flatMap((row) => Effect.mapError(Schema.decodeUnknownEffect(AdminCountRow)(row), unreadable)),
    Effect.map((row) => row.count),
  );
}

function dropRows(db: SqliteDatabase, name: IdentityName): Fails<void> {
  return Effect.andThen(
    db.run("UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0", name),
    Effect.andThen(
      Effect.forEach(INBOX_TABLES, (table) => db.run(`DELETE FROM ${table} WHERE identity_name = ?`, name), {
        concurrency: 1,
      }),
      db.run("DELETE FROM identities WHERE name = ?", name),
    ),
  );
}

function deleteRow(db: SqliteDatabase, row: unknown): Fails<DeleteIdentityResult> {
  return Effect.gen(function* deleteIdentityRow() {
    const decoded = yield* Effect.mapError(Schema.decodeUnknownEffect(IdentityRow)(row), unreadable);
    const identity = toIdentity(decoded);
    const admins = yield* countAdmins(db);
    const owns = yield* sqliteOwnsAgents(db, identity.name);
    const refused = deleteRefusal(identity, admins, owns);
    if (Option.isSome(refused)) {
      return refused.value;
    }
    yield* dropRows(db, identity.name);
    return { identity, status: "deleted" } as const;
  });
}

function sqliteDeleteIdentity(db: SqliteDatabase): (name: IdentityName) => Fails<DeleteIdentityResult> {
  return (name) =>
    db.transaction(
      Effect.flatMap(db.get(SELECT_IDENTITY, name), (row) => {
        if (Predicate.isUndefined(row)) {
          return Effect.succeed<DeleteIdentityResult>({ status: "not_found" });
        }
        return deleteRow(db, row);
      }),
    );
}

export {
  type CreateRefusal,
  type DeleteIdentityResult,
  memoryCreateRefusal,
  memoryDeleteIdentity,
  sqliteCreateRefusal,
  sqliteDeleteIdentity,
};
