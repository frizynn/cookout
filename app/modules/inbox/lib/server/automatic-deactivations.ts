import { Array as Arr, Effect, Option, Predicate, PubSub } from "effect";
import type { AutomaticDeactivation, AutomaticDeactivationId, AutomaticDeactivationResponse } from "../../index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { IdentityChanges, THE_COOKOUT } from "../../../identities/server.ts";
import type { Storage, StorageUnavailable, StoredAutomaticDeactivation } from "../../../storage/server.ts";
import { isAutomaticDeactivationId, quietAgentDays } from "../../index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import { automaticDeactivationText } from "../deactivation-offers.ts";
import { echoed } from "../../../http/index.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface AutomaticDeactivationChanged {
  readonly recipient: IdentityName;
  readonly automaticDeactivation: AutomaticDeactivation;
}

interface AutomaticDeactivationsService {
  readonly listAutomaticDeactivations: (
    caller: Identity,
    which: "unread" | "all",
  ) => Effect.Effect<readonly AutomaticDeactivation[], StorageUnavailable>;
  readonly markAutomaticDeactivationRead: (caller: Identity, asked: string) => Fails<AutomaticDeactivationResponse>;
  readonly markAutomaticDeactivationsReadUpTo: (
    caller: Identity,
    upTo: AutomaticDeactivationId,
  ) => Effect.Effect<void, StorageUnavailable>;
  readonly deactivateQuietAgents: (now: IsoTime) => Effect.Effect<void, StorageUnavailable>;
  readonly automaticDeactivationChanged: Effect.Effect<
    PubSub.Subscription<AutomaticDeactivationChanged>,
    never,
    Scope.Scope
  >;
}

interface On {
  readonly storage: Storage["Service"];
  readonly announce: (identity: Identity) => Effect.Effect<void>;
  readonly endTokensOf: (agent: IdentityName) => Effect.Effect<void>;
  readonly publishAll: (changed: readonly AutomaticDeactivationChanged[]) => Effect.Effect<boolean>;
}

const NOT_FOUND = 404;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ALL_TOKENS = { kind: "all" } as const;

function entryNotFound(asked: string): Refusal {
  return {
    code: "automatic_deactivation_not_found",
    message: `You have no automatic deactivation ${echoed(asked)}.`,
    status: NOT_FOUND,
  };
}

function shownEntry(
  storage: Storage["Service"],
): (stored: StoredAutomaticDeactivation) => Effect.Effect<readonly AutomaticDeactivation[], StorageUnavailable> {
  return ({ deactivatedAt, id, identity: name, read }) =>
    Effect.map(storage.findIdentityByName(name), (found) =>
      Arr.map(Arr.fromNullishOr(found), (identity) => ({
        deactivatedAt,
        id,
        identity,
        read,
        text: automaticDeactivationText(identity.name),
      })),
    );
}

function shownEntries(
  storage: Storage["Service"],
  stored: readonly StoredAutomaticDeactivation[],
): Effect.Effect<readonly AutomaticDeactivation[], StorageUnavailable> {
  return Effect.map(Effect.forEach(stored, shownEntry(storage), ONE_AT_A_TIME), Arr.flatten);
}

function changesFor(
  storage: Storage["Service"],
): (entry: StoredAutomaticDeactivation) => Effect.Effect<readonly AutomaticDeactivationChanged[], StorageUnavailable> {
  return (entry) =>
    Effect.map(shownEntry(storage)(entry), (shown) =>
      Arr.flatMap(shown, (automaticDeactivation) =>
        Arr.map(entry.recipients, (recipient) => ({ automaticDeactivation, recipient })),
      ),
    );
}

function published(on: On, stored: readonly StoredAutomaticDeactivation[]): Effect.Effect<void, StorageUnavailable> {
  return Effect.forEach(stored, changesFor(on.storage), ONE_AT_A_TIME).pipe(
    Effect.map(Arr.flatten),
    Effect.flatMap(on.publishAll),
    Effect.asVoid,
  );
}

function endedByTheCookout(on: On): (stored: StoredAutomaticDeactivation) => Effect.Effect<void, StorageUnavailable> {
  return (stored) =>
    Effect.gen(function* announceDeactivation() {
      const found = yield* on.storage.findIdentityByName(stored.identity);
      yield* Effect.forEach(Arr.fromNullishOr(found), on.announce, { concurrency: 1, discard: true });
      yield* on.endTokensOf(stored.identity);
    });
}

function deactivatedQuietAgents(on: On, now: IsoTime): Effect.Effect<void, StorageUnavailable> {
  return Effect.gen(function* deactivateQuietAgents() {
    const stored = yield* on.storage.deactivateQuietAgents(now, quietAgentDays);
    yield* Effect.forEach(stored, endedByTheCookout(on), { concurrency: 1, discard: true });
    yield* published(on, stored);
  });
}

function markedRead(on: On, caller: Identity, asked: string): Fails<AutomaticDeactivationResponse> {
  return Effect.gen(function* markEntryRead() {
    const marked = yield* Option.match(Option.liftPredicate(Number(asked), isAutomaticDeactivationId), {
      onNone: () => Effect.succeed(null),
      onSome: (id) => on.storage.markAutomaticDeactivationRead(caller.name, id),
    });
    const [automaticDeactivation] = yield* shownEntries(on.storage, Arr.fromNullishOr(marked));
    if (marked === null || Predicate.isUndefined(automaticDeactivation)) {
      return yield* Effect.fail(entryNotFound(asked));
    }
    yield* published(on, [marked]);
    return { automaticDeactivation };
  });
}

function listed(
  on: On,
  caller: Identity,
  which: "unread" | "all",
): Effect.Effect<readonly AutomaticDeactivation[], StorageUnavailable> {
  return Effect.flatMap(on.storage.listAutomaticDeactivations(caller.name), (stored) =>
    shownEntries(
      on.storage,
      Arr.filter(stored, (entry) => which === "all" || !entry.read),
    ),
  );
}

function automaticDeactivationsOn(
  storage: Storage["Service"],
): Effect.Effect<AutomaticDeactivationsService, never, IdentityChanges | Scope.Scope> {
  return Effect.gen(function* openAutomaticDeactivations() {
    const changes = yield* IdentityChanges;
    const hub = yield* PubSub.unbounded<AutomaticDeactivationChanged>();
    const on: On = {
      announce: changes.publish,
      endTokensOf: (agent) =>
        changes.endTokens({ by: THE_COOKOUT, cause: "deactivated", identity: agent, tokens: ALL_TOKENS }),
      publishAll: (changed) => PubSub.publishAll(hub, changed),
      storage,
    };
    yield* changes.onReactivated((identity) =>
      Effect.ignore(Effect.flatMap(storage.readAutomaticDeactivationsOf(identity.name), (read) => published(on, read))),
    );
    return {
      automaticDeactivationChanged: PubSub.subscribe(hub),
      deactivateQuietAgents: (now) => deactivatedQuietAgents(on, now),
      listAutomaticDeactivations: (caller, which) => listed(on, caller, which),
      markAutomaticDeactivationRead: (caller, asked) => markedRead(on, caller, asked),
      markAutomaticDeactivationsReadUpTo: (caller, upTo) =>
        Effect.flatMap(storage.markAutomaticDeactivationsReadUpTo(caller.name, upTo), (read) => published(on, read)),
    };
  });
}

export { type AutomaticDeactivationsService, automaticDeactivationsOn };
