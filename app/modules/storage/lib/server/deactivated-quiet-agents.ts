import { Array as Arr, Effect, Option } from "effect";
import type { Board, QuietDays } from "./deactivation-offer-board.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { dueDeactivations, recipientsOf } from "./deactivation-offer-board.ts";
import type { DeactivateIdentityResult } from "./identity-deactivations.ts";
import type { DeactivatedQuietAgentId } from "../../../inbox/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredDeactivatedQuietAgent {
  readonly id: DeactivatedQuietAgentId;
  readonly identity: IdentityName;
  readonly recipients: readonly IdentityName[];
  readonly deactivatedAt: IsoTime;
  readonly read: boolean;
}

type NewDeactivatedQuietAgent = Omit<StoredDeactivatedQuietAgent, "id" | "read">;

interface DeactivatedQuietAgentRecords {
  readonly deactivatedQuietAgents: Effect.Effect<readonly StoredDeactivatedQuietAgent[], StorageUnavailable>;
  readonly insert: (record: NewDeactivatedQuietAgent) => Fails<StoredDeactivatedQuietAgent>;
  readonly markRead: (ids: readonly DeactivatedQuietAgentId[]) => Fails<void>;
}

interface DeactivatedQuietAgentsSection {
  readonly deactivateQuietAgents: (now: IsoTime, days: QuietDays) => Fails<readonly StoredDeactivatedQuietAgent[]>;
  readonly listDeactivatedQuietAgents: (recipient: IdentityName) => Fails<readonly StoredDeactivatedQuietAgent[]>;
  readonly markDeactivatedQuietAgentRead: (
    recipient: IdentityName,
    id: DeactivatedQuietAgentId,
  ) => Fails<StoredDeactivatedQuietAgent | null>;
  readonly markDeactivatedQuietAgentsReadUpTo: (
    recipient: IdentityName,
    upTo: DeactivatedQuietAgentId,
  ) => Fails<readonly StoredDeactivatedQuietAgent[]>;
  readonly readDeactivatedQuietAgentsOf: (identity: IdentityName) => Fails<readonly StoredDeactivatedQuietAgent[]>;
}

interface DeactivationsOn {
  readonly board: Effect.Effect<Board, StorageUnavailable>;
  readonly records: DeactivatedQuietAgentRecords;
  readonly deactivate: (name: IdentityName) => Fails<boolean>;
}

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function asRead(record: StoredDeactivatedQuietAgent): StoredDeactivatedQuietAgent {
  return { ...record, read: true };
}

function deactivateOne(
  on: DeactivationsOn,
  board: Board,
  now: IsoTime,
): (agent: Identity) => Fails<readonly StoredDeactivatedQuietAgent[]> {
  return (agent) =>
    Effect.gen(function* deactivateQuietAgent() {
      const recipients = recipientsOf({ board, identity: agent });
      const deactivated = yield* on.deactivate(agent.name);
      if (!deactivated) {
        return [];
      }
      const recorded = yield* on.records.insert({ deactivatedAt: now, identity: agent.name, recipients });
      return [recorded];
    });
}

function deactivateQuiet(
  on: DeactivationsOn,
  now: IsoTime,
  days: QuietDays,
): Fails<readonly StoredDeactivatedQuietAgent[]> {
  return Effect.gen(function* deactivateQuietAgents() {
    const board = yield* on.board;
    const ready = Arr.filter(dueDeactivations({ board, days }), ({ at }) => at <= now);
    const recorded = yield* Effect.forEach(
      ready,
      ({ identity }) => deactivateOne(on, board, now)(identity),
      ONE_AT_A_TIME,
    );
    return Arr.flatten(recorded);
  });
}

function readWhere(
  on: DeactivationsOn,
  reading: (record: StoredDeactivatedQuietAgent) => boolean,
): Fails<readonly StoredDeactivatedQuietAgent[]> {
  return Effect.gen(function* readEntries() {
    const all = yield* on.records.deactivatedQuietAgents;
    const unread = Arr.filter(all, (record) => !record.read && reading(record));
    yield* on.records.markRead(Arr.map(unread, ({ id }) => id));
    return Arr.map(unread, asRead);
  });
}

function sentTo(recipient: IdentityName): (record: StoredDeactivatedQuietAgent) => boolean {
  return (record) => record.recipients.includes(recipient);
}

function markOneRead(
  on: DeactivationsOn,
  recipient: IdentityName,
  id: DeactivatedQuietAgentId,
): Fails<StoredDeactivatedQuietAgent | null> {
  return Effect.gen(function* markEntryRead() {
    const all = yield* on.records.deactivatedQuietAgents;
    const found = Arr.findFirst(all, (record) => record.id === id && sentTo(recipient)(record));
    if (Option.isNone(found)) {
      return null;
    }
    yield* on.records.markRead([id]);
    return asRead(found.value);
  });
}

function deactivatingWith(
  deactivateIdentity: (name: IdentityName) => Fails<DeactivateIdentityResult>,
): DeactivationsOn["deactivate"] {
  return (name) => Effect.map(deactivateIdentity(name), ({ status }) => status === "deactivated");
}

function deactivatedQuietAgentsOn(on: DeactivationsOn): DeactivatedQuietAgentsSection {
  return {
    deactivateQuietAgents: (now, days) => deactivateQuiet(on, now, days),
    listDeactivatedQuietAgents: (recipient) =>
      Effect.map(on.records.deactivatedQuietAgents, (all) => Arr.filter(all, sentTo(recipient))),
    markDeactivatedQuietAgentRead: (recipient, id) => markOneRead(on, recipient, id),
    markDeactivatedQuietAgentsReadUpTo: (recipient, upTo) =>
      readWhere(on, (record) => record.id <= upTo && sentTo(recipient)(record)),
    readDeactivatedQuietAgentsOf: (identity) => readWhere(on, (record) => record.identity === identity),
  };
}

export {
  type DeactivatedQuietAgentRecords,
  type DeactivatedQuietAgentsSection,
  type StoredDeactivatedQuietAgent,
  deactivatedQuietAgentsOn,
  deactivatingWith,
};
