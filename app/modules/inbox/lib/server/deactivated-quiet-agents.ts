import { Array as Arr, Effect, Option, Predicate, PubSub } from "effect";
import type { DeactivatedQuietAgent, DeactivatedQuietAgentId, DeactivatedQuietAgentResponse } from "../../index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { IdentityChanges, THE_COOKOUT } from "../../../identities/server.ts";
import type { Storage, StorageUnavailable, StoredDeactivatedQuietAgent } from "../../../storage/server.ts";
import { isDeactivatedQuietAgentId, quietAgentDays } from "../../index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import { deactivatedQuietAgentText } from "../deactivation-offers.ts";
import { echoed } from "../../../http/index.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface DeactivatedQuietAgentChanged {
  readonly recipient: IdentityName;
  readonly deactivatedQuietAgent: DeactivatedQuietAgent;
}

interface DeactivatedQuietAgentsService {
  readonly listDeactivatedQuietAgents: (
    caller: Identity,
    which: "unread" | "all",
  ) => Effect.Effect<readonly DeactivatedQuietAgent[], StorageUnavailable>;
  readonly markDeactivatedQuietAgentRead: (caller: Identity, asked: string) => Fails<DeactivatedQuietAgentResponse>;
  readonly markDeactivatedQuietAgentsReadUpTo: (
    caller: Identity,
    upTo: DeactivatedQuietAgentId,
  ) => Effect.Effect<void, StorageUnavailable>;
  readonly deactivateQuietAgents: (now: IsoTime) => Effect.Effect<void, StorageUnavailable>;
  readonly deactivatedQuietAgentChanged: Effect.Effect<
    PubSub.Subscription<DeactivatedQuietAgentChanged>,
    never,
    Scope.Scope
  >;
}

interface On {
  readonly storage: Storage["Service"];
  readonly announce: (identity: Identity) => Effect.Effect<void>;
  readonly endTokensOf: (agent: IdentityName) => Effect.Effect<void>;
  readonly publishAll: (changed: readonly DeactivatedQuietAgentChanged[]) => Effect.Effect<boolean>;
}

const NOT_FOUND = 404;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ALL_TOKENS = { kind: "all" } as const;

function entryNotFound(asked: string): Refusal {
  return {
    code: "deactivated_quiet_agent_not_found",
    message: `You have no entry ${echoed(asked)} about a deactivated quiet agent.`,
    status: NOT_FOUND,
  };
}

function shownEntry(
  storage: Storage["Service"],
): (stored: StoredDeactivatedQuietAgent) => Effect.Effect<readonly DeactivatedQuietAgent[], StorageUnavailable> {
  return ({ deactivatedAt, id, identity: name, read }) =>
    Effect.map(storage.findIdentityByName(name), (found) =>
      Arr.map(Arr.fromNullishOr(found), (identity) => ({
        deactivatedAt,
        id,
        identity,
        read,
        text: deactivatedQuietAgentText(identity.name),
      })),
    );
}

function shownEntries(
  storage: Storage["Service"],
  stored: readonly StoredDeactivatedQuietAgent[],
): Effect.Effect<readonly DeactivatedQuietAgent[], StorageUnavailable> {
  return Effect.map(Effect.forEach(stored, shownEntry(storage), ONE_AT_A_TIME), Arr.flatten);
}

function changesFor(
  storage: Storage["Service"],
): (entry: StoredDeactivatedQuietAgent) => Effect.Effect<readonly DeactivatedQuietAgentChanged[], StorageUnavailable> {
  return (entry) =>
    Effect.map(shownEntry(storage)(entry), (shown) =>
      Arr.flatMap(shown, (deactivatedQuietAgent) =>
        Arr.map(entry.recipients, (recipient) => ({ deactivatedQuietAgent, recipient })),
      ),
    );
}

function published(on: On, stored: readonly StoredDeactivatedQuietAgent[]): Effect.Effect<void, StorageUnavailable> {
  return Effect.forEach(stored, changesFor(on.storage), ONE_AT_A_TIME).pipe(
    Effect.map(Arr.flatten),
    Effect.flatMap(on.publishAll),
    Effect.asVoid,
  );
}

function endedByTheCookout(on: On): (stored: StoredDeactivatedQuietAgent) => Effect.Effect<void, StorageUnavailable> {
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

function markedRead(on: On, caller: Identity, asked: string): Fails<DeactivatedQuietAgentResponse> {
  return Effect.gen(function* markEntryRead() {
    const marked = yield* Option.match(Option.liftPredicate(Number(asked), isDeactivatedQuietAgentId), {
      onNone: () => Effect.succeed(null),
      onSome: (id) => on.storage.markDeactivatedQuietAgentRead(caller.name, id),
    });
    const [deactivatedQuietAgent] = yield* shownEntries(on.storage, Arr.fromNullishOr(marked));
    if (marked === null || Predicate.isUndefined(deactivatedQuietAgent)) {
      return yield* Effect.fail(entryNotFound(asked));
    }
    yield* published(on, [marked]);
    return { deactivatedQuietAgent };
  });
}

function listed(
  on: On,
  caller: Identity,
  which: "unread" | "all",
): Effect.Effect<readonly DeactivatedQuietAgent[], StorageUnavailable> {
  return Effect.flatMap(on.storage.listDeactivatedQuietAgents(caller.name), (stored) =>
    shownEntries(
      on.storage,
      Arr.filter(stored, (entry) => which === "all" || !entry.read),
    ),
  );
}

function deactivatedQuietAgentsOn(
  storage: Storage["Service"],
): Effect.Effect<DeactivatedQuietAgentsService, never, IdentityChanges | Scope.Scope> {
  return Effect.gen(function* openDeactivatedQuietAgents() {
    const changes = yield* IdentityChanges;
    const hub = yield* PubSub.unbounded<DeactivatedQuietAgentChanged>();
    const on: On = {
      announce: changes.publish,
      endTokensOf: (agent) =>
        changes.endTokens({ by: THE_COOKOUT, cause: "deactivated", identity: agent, tokens: ALL_TOKENS }),
      publishAll: (changed) => PubSub.publishAll(hub, changed),
      storage,
    };
    yield* changes.onReactivated((identity) =>
      Effect.ignore(Effect.flatMap(storage.readDeactivatedQuietAgentsOf(identity.name), (read) => published(on, read))),
    );
    return {
      deactivateQuietAgents: (now) => deactivatedQuietAgents(on, now),
      deactivatedQuietAgentChanged: PubSub.subscribe(hub),
      listDeactivatedQuietAgents: (caller, which) => listed(on, caller, which),
      markDeactivatedQuietAgentRead: (caller, asked) => markedRead(on, caller, asked),
      markDeactivatedQuietAgentsReadUpTo: (caller, upTo) =>
        Effect.flatMap(storage.markDeactivatedQuietAgentsReadUpTo(caller.name, upTo), (read) => published(on, read)),
    };
  });
}

export { type DeactivatedQuietAgentsService, deactivatedQuietAgentsOn };
