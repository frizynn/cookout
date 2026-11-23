import type { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { LeaseId } from "../../../leases/index.ts";
import { Option } from "effect";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredLease {
  readonly identity: IdentityName;
  readonly leaseId: LeaseId;
  readonly expiresAt: IsoTime;
}

interface TakeLease {
  readonly identity: IdentityName;
  readonly leaseId: LeaseId;
  readonly now: IsoTime;
  readonly expiresAt: IsoTime;
  readonly force: boolean;
}

interface RenewLease {
  readonly identity: IdentityName;
  readonly leaseId: LeaseId;
  readonly now: IsoTime;
  readonly expiresAt: IsoTime;
}

interface ReleaseLease {
  readonly identity: IdentityName;
  readonly leaseId: LeaseId;
  readonly now: IsoTime;
}

type TakeLeaseResult =
  | { readonly status: "taken"; readonly lease: StoredLease }
  | { readonly status: "held"; readonly heldUntil: IsoTime };

interface LeaseLost {
  readonly status: "lost";
  readonly heldUntil: IsoTime | null;
}

type RenewLeaseResult = { readonly status: "renewed"; readonly lease: StoredLease } | LeaseLost;

type ReleaseLeaseResult = { readonly status: "released" } | LeaseLost;

interface LeasesSection {
  readonly takeLease: (request: TakeLease) => Fails<TakeLeaseResult>;
  readonly renewLease: (request: RenewLease) => Fails<RenewLeaseResult>;
  readonly releaseLease: (request: ReleaseLease) => Fails<ReleaseLeaseResult>;
  readonly findLease: (identity: IdentityName, now: IsoTime) => Fails<StoredLease | undefined>;
}

function liveAt(now: IsoTime): (lease: StoredLease) => boolean {
  return (lease) => now < lease.expiresAt;
}

function expiryOf(lease: StoredLease): IsoTime {
  return lease.expiresAt;
}

function lost(current: Option.Option<StoredLease>): LeaseLost {
  return { heldUntil: Option.getOrNull(Option.map(current, expiryOf)), status: "lost" };
}

function heldWith(leaseId: LeaseId): (lease: StoredLease) => boolean {
  return (lease) => lease.leaseId === leaseId;
}

export {
  type LeasesSection,
  type ReleaseLease,
  type ReleaseLeaseResult,
  type RenewLease,
  type RenewLeaseResult,
  type StoredLease,
  type TakeLease,
  type TakeLeaseResult,
  heldWith,
  liveAt,
  lost,
};
