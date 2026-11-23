import { Array as Arr, Effect, Predicate, Schema } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { IdentityRow, toIdentity } from "./identity-row.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

type SetAdminResult =
  | { readonly status: "set"; readonly identity: Identity }
  | { readonly status: "agent"; readonly identity: Identity }
  | { readonly status: "not_found" }
  | { readonly status: "last_admin" };

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type SetAdmin = (name: IdentityName, admin: boolean) => Fails<SetAdminResult>;

const LAST_ADMIN_COUNT = 1;

const SELECT_IDENTITY = "SELECT name, kind, owner, admin, created_at FROM identities WHERE name = ?";

const COUNT_ADMINS = "SELECT count(*) AS count FROM identities WHERE admin = 1";

const AdminCountRow = Schema.Struct({ count: Schema.Int });

function clearsLastAdmin(identity: Identity, admin: boolean, admins: number): boolean {
  return !admin && identity.admin && admins === LAST_ADMIN_COUNT;
}

function adminChange(identity: Identity, admin: boolean, admins: number): SetAdminResult {
  if (admin && identity.kind === "agent") {
    return { identity, status: "agent" };
  }
  if (clearsLastAdmin(identity, admin, admins)) {
    return { status: "last_admin" };
  }
  return { identity: { ...identity, admin }, status: "set" };
}

function memorySetAdmin(
  identities: Map<IdentityName, Identity>,
): (name: IdentityName, admin: boolean) => SetAdminResult {
  return (name, admin) => {
    const identity = identities.get(name);
    if (Predicate.isUndefined(identity)) {
      return { status: "not_found" };
    }
    const admins = Arr.filter([...identities.values()], (found) => found.admin).length;
    const result = adminChange({ ...identity }, admin, admins);
    if (result.status === "set") {
      identities.set(name, { ...result.identity });
    }
    return result;
  };
}

function countAdmins(db: SqliteDatabase): Fails<number> {
  return db.get(COUNT_ADMINS).pipe(
    Effect.flatMap((row) => Effect.mapError(Schema.decodeUnknownEffect(AdminCountRow)(row), unreadable)),
    Effect.map((row) => row.count),
  );
}

function setAdminRow(db: SqliteDatabase, row: unknown, admin: boolean): Fails<SetAdminResult> {
  return Effect.gen(function* setAdminOnRow() {
    const decoded = yield* Effect.mapError(Schema.decodeUnknownEffect(IdentityRow)(row), unreadable);
    const admins = yield* countAdmins(db);
    const result = adminChange(toIdentity(decoded), admin, admins);
    if (result.status === "set") {
      yield* db.run("UPDATE identities SET admin = ? WHERE name = ?", Number(admin), decoded.name);
    }
    return result;
  });
}

function sqliteSetAdmin(db: SqliteDatabase): SetAdmin {
  return (name, admin) =>
    db.transaction(
      Effect.flatMap(db.get(SELECT_IDENTITY, name), (row) => {
        if (Predicate.isUndefined(row)) {
          return Effect.succeed<SetAdminResult>({ status: "not_found" });
        }
        return setAdminRow(db, row, admin);
      }),
    );
}

export { memorySetAdmin, type SetAdminResult, sqliteSetAdmin };
