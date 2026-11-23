import { Context, DateTime, Effect, Layer, Option, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { LeaseId, LeaseResponse } from "../../index.ts";
import type { StorageUnavailable, StoredLease } from "../../../storage/server.ts";
import { leaseHeld, leaseLost, leaseRequired, notYourIdentity } from "./refusals.ts";
import type { Config } from "effect";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { isLeaseId } from "../../index.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { leaseSeconds } from "../../../config/server.ts";

interface Join {
  readonly as: IdentityName;
  readonly force?: boolean;
}

interface Times {
  readonly now: IsoTime;
  readonly expiresAt: IsoTime;
}

interface LeasesOn {
  readonly seconds: number;
  readonly secrets: Secrets["Service"];
  readonly storage: Storage["Service"];
}

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

type Sent = string | undefined;

interface LeasesService {
  readonly join: (caller: Identity, request: Join, sent: Sent) => Fails<LeaseResponse>;
  readonly leave: (caller: Identity, sent: Sent) => Fails<void>;
  readonly renew: (caller: Identity, sent: Sent) => Effect.Effect<void, StorageUnavailable>;
  readonly requireLease: (caller: Identity, sent: Sent) => Fails<LeaseId>;
}

class Leases extends Context.Service<Leases, LeasesService>()("@ai-hero/cookout/leases/lib/server/service/Leases") {}

function responseOf({ expiresAt, leaseId }: StoredLease): LeaseResponse {
  return { expiresAt, leaseId };
}

function heldUntil(lease: StoredLease | undefined): IsoTime | null {
  if (Predicate.isUndefined(lease)) {
    return null;
  }
  return lease.expiresAt;
}

function timesFor(seconds: number): Effect.Effect<Times> {
  return Effect.gen(function* leaseTimes() {
    const now = yield* DateTime.now;
    return { expiresAt: isoTimeOf(DateTime.add(now, { seconds })), now: isoTimeOf(now) };
  });
}

function renewer({ seconds, storage }: LeasesOn) {
  return (caller: Identity, sent: Sent): Effect.Effect<Option.Option<StoredLease>, StorageUnavailable> =>
    Effect.gen(function* renewSent() {
      if (Predicate.isUndefined(sent) || !isLeaseId(sent)) {
        return Option.none();
      }
      const { expiresAt, now } = yield* timesFor(seconds);
      const result = yield* storage.renewLease({ expiresAt, identity: caller.name, leaseId: sent, now });
      if (result.status === "renewed") {
        return Option.some(result.lease);
      }
      return Option.none();
    });
}

function taker({ seconds, secrets, storage }: LeasesOn) {
  return (caller: Identity, force: boolean): Fails<LeaseResponse> =>
    Effect.gen(function* takeLease() {
      const leaseId = yield* secrets.newLeaseId;
      const { expiresAt, now } = yield* timesFor(seconds);
      const taken = yield* storage.takeLease({ expiresAt, force, identity: caller.name, leaseId, now });
      if (taken.status === "held") {
        return yield* Effect.fail(leaseHeld({ heldUntil: taken.heldUntil, identity: caller.name }));
      }
      return responseOf(taken.lease);
    });
}

function requirer({ seconds, storage }: LeasesOn) {
  return (caller: Identity, sent: Sent): Fails<LeaseId> =>
    Effect.gen(function* requireLive() {
      const { now } = yield* timesFor(seconds);
      const current = yield* storage.findLease(caller.name, now);
      const conflict = { heldUntil: heldUntil(current), identity: caller.name };
      if (Predicate.isUndefined(sent)) {
        return yield* Effect.fail(leaseRequired(conflict));
      }
      if (Predicate.isUndefined(current) || current.leaseId !== sent) {
        return yield* Effect.fail(leaseLost(conflict));
      }
      return current.leaseId;
    });
}

function joiner(on: LeasesOn) {
  const renew = renewer(on);
  const take = taker(on);
  return (caller: Identity, request: Join, sent: Sent): Fails<LeaseResponse> =>
    Effect.gen(function* joinAs() {
      if (request.as !== caller.name) {
        return yield* Effect.fail(notYourIdentity({ asked: request.as, caller: caller.name }));
      }
      const kept = yield* renew(caller, sent);
      if (Option.isSome(kept)) {
        return responseOf(kept.value);
      }
      return yield* take(caller, request.force === true);
    });
}

function leaver(on: LeasesOn) {
  const requireLease = requirer(on);
  return (caller: Identity, sent: Sent): Fails<void> =>
    Effect.gen(function* leaveLease() {
      const leaseId = yield* requireLease(caller, sent);
      const { now } = yield* timesFor(on.seconds);
      const released = yield* on.storage.releaseLease({ identity: caller.name, leaseId, now });
      if (released.status === "lost") {
        return yield* Effect.fail(leaseLost({ heldUntil: released.heldUntil, identity: caller.name }));
      }
      return yield* Effect.void;
    });
}

function leasesOn(on: LeasesOn): LeasesService {
  const renew = renewer(on);
  return {
    join: joiner(on),
    leave: leaver(on),
    renew: (caller, sent) => Effect.asVoid(renew(caller, sent)),
    requireLease: requirer(on),
  };
}

const leasesLayer: Layer.Layer<Leases, Config.ConfigError, Storage | Secrets> = Layer.effect(
  Leases,
  Effect.gen(function* leasesOnStorage() {
    const seconds = yield* leaseSeconds;
    const storage = yield* Storage;
    const secrets = yield* Secrets;
    return leasesOn({ seconds, secrets, storage });
  }),
);

export { Leases, leasesLayer };
