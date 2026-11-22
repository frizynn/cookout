import { Effect, Option, Predicate, Schema } from "effect";
import type {
  LeasesSection,
  ReleaseLease,
  ReleaseLeaseResult,
  RenewLease,
  RenewLeaseResult,
  StoredLease,
  TakeLease,
  TakeLeaseResult,
} from "./leases.ts";
import { heldWith, liveAt, lost } from "./leases.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isLeaseId } from "../../../leases/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface Asked {
  readonly identity: IdentityName;
  readonly now: IsoTime;
}

const LeaseRow = Schema.Struct({
  expires_at: IsoTimeSchema,
  identity_name: Schema.String.pipe(Schema.refine(isIdentityName)),
  lease_id: Schema.String.pipe(Schema.refine(isLeaseId)),
});

const SELECT_LEASE = "SELECT identity_name, lease_id, expires_at FROM leases WHERE identity_name = ?";

const UPSERT_LEASE = `INSERT INTO leases (identity_name, lease_id, expires_at) VALUES (?, ?, ?)
  ON CONFLICT (identity_name) DO UPDATE SET lease_id = excluded.lease_id, expires_at = excluded.expires_at`;

function leaseOf(row: typeof LeaseRow.Type): StoredLease {
  return { expiresAt: row.expires_at, identity: row.identity_name, leaseId: row.lease_id };
}

function toLease(row: unknown): Fails<Option.Option<StoredLease>> {
  if (!Predicate.isObject(row)) {
    return Effect.succeedNone;
  }
  return Schema.decodeUnknownEffect(LeaseRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: (decoded) => Option.some(leaseOf(decoded)) }),
  );
}

function liveLease(db: SqliteDatabase, { identity, now }: Asked): Fails<Option.Option<StoredLease>> {
  const live = Option.filter(liveAt(now));
  return db.get(SELECT_LEASE, identity).pipe(Effect.flatMap(toLease), Effect.map(live));
}

function save(db: SqliteDatabase, lease: StoredLease): Fails<void> {
  return db.run(UPSERT_LEASE, lease.identity, lease.leaseId, lease.expiresAt);
}

function take(db: SqliteDatabase, request: TakeLease): Fails<TakeLeaseResult> {
  return Effect.gen(function* takeLease() {
    const current = yield* liveLease(db, request);
    if (Option.isSome(current) && !request.force) {
      return { heldUntil: current.value.expiresAt, status: "held" } as const;
    }
    const lease = { expiresAt: request.expiresAt, identity: request.identity, leaseId: request.leaseId };
    yield* save(db, lease);
    return { lease, status: "taken" } as const;
  });
}

function renew(db: SqliteDatabase, request: RenewLease): Fails<RenewLeaseResult> {
  return Effect.gen(function* renewLease() {
    const current = yield* liveLease(db, request);
    if (!Option.exists(current, heldWith(request.leaseId))) {
      return lost(current);
    }
    const lease = { expiresAt: request.expiresAt, identity: request.identity, leaseId: request.leaseId };
    yield* save(db, lease);
    return { lease, status: "renewed" } as const;
  });
}

function release(db: SqliteDatabase, request: ReleaseLease): Fails<ReleaseLeaseResult> {
  return Effect.gen(function* releaseLease() {
    const current = yield* liveLease(db, request);
    if (!Option.exists(current, heldWith(request.leaseId))) {
      return lost(current);
    }
    yield* db.run("DELETE FROM leases WHERE identity_name = ?", request.identity);
    return { status: "released" } as const;
  });
}

function sqliteLeases(db: SqliteDatabase): LeasesSection {
  return {
    findLease: (identity, now) => Effect.map(liveLease(db, { identity, now }), Option.getOrUndefined),
    releaseLease: (request) => db.transaction(release(db, request)),
    renewLease: (request) => db.transaction(renew(db, request)),
    takeLease: (request) => db.transaction(take(db, request)),
  };
}

export { sqliteLeases };
