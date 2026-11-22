import { Effect, Option, Record as Rec, Ref } from "effect";
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
import type { MemoryState } from "./memory-state.ts";
import type { StorageUnavailable } from "./errors.ts";

type Leases = Readonly<Record<IdentityName, StoredLease>>;

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface MemoryLeases extends LeasesSection {
  readonly dropLease: (identity: IdentityName) => Effect.Effect<void>;
}

interface Asked {
  readonly identity: IdentityName;
  readonly now: string;
}

function liveIn(leases: Leases, { identity, now }: Asked): Option.Option<StoredLease> {
  return Option.filter(Rec.get(leases, identity), liveAt(now));
}

function take(leases: Leases, request: TakeLease): readonly [TakeLeaseResult, Leases] {
  const current = liveIn(leases, request);
  if (Option.isSome(current) && !request.force) {
    return [{ heldUntil: current.value.expiresAt, status: "held" }, leases];
  }
  const lease = { expiresAt: request.expiresAt, identity: request.identity, leaseId: request.leaseId };
  return [{ lease, status: "taken" }, Rec.set(leases, request.identity, lease)];
}

function renew(leases: Leases, request: RenewLease): readonly [RenewLeaseResult, Leases] {
  const current = liveIn(leases, request);
  if (!Option.exists(current, heldWith(request.leaseId))) {
    return [lost(current), leases];
  }
  const lease = { expiresAt: request.expiresAt, identity: request.identity, leaseId: request.leaseId };
  return [{ lease, status: "renewed" }, Rec.set(leases, request.identity, lease)];
}

function release(leases: Leases, request: ReleaseLease): readonly [ReleaseLeaseResult, Leases] {
  const current = liveIn(leases, request);
  if (!Option.exists(current, heldWith(request.leaseId))) {
    return [lost(current), leases];
  }
  return [{ status: "released" }, Rec.remove(leases, request.identity)];
}

function memoryLeases(state: MemoryState): MemoryLeases {
  const empty: Leases = Rec.empty();
  const ref = Ref.makeUnsafe(empty);
  function change<Value>(work: (leases: Leases) => readonly [Value, Leases]): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Ref.modify(ref, work));
  }
  function find(asked: Asked): Fails<StoredLease | undefined> {
    return Effect.andThen(
      state.ensureOpen,
      Effect.map(Ref.get(ref), (leases) => Option.getOrUndefined(liveIn(leases, asked))),
    );
  }
  return {
    dropLease: (identity) => Ref.update(ref, (leases) => Rec.remove(leases, identity)),
    findLease: (identity, now) => find({ identity, now }),
    releaseLease: (request) => change((leases) => release(leases, request)),
    renewLease: (request) => change((leases) => renew(leases, request)),
    takeLease: (request) => change((leases) => take(leases, request)),
  };
}

export { memoryLeases };
