import { Array as Arr, Effect, Option } from "effect";
import type { Board, QuietDays } from "./deactivation-offer-board.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { dueDeactivations, recipientsOf } from "./deactivation-offer-board.ts";
import type { AutomaticDeactivationId } from "../../../inbox/index.ts";
import type { DeactivateIdentityResult } from "./identity-deactivations.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredAutomaticDeactivation {
  readonly id: AutomaticDeactivationId;
  readonly identity: IdentityName;
  readonly recipients: readonly IdentityName[];
  readonly deactivatedAt: IsoTime;
  readonly read: boolean;
}

type NewAutomaticDeactivation = Omit<StoredAutomaticDeactivation, "id" | "read">;

interface AutomaticDeactivationRecords {
  readonly automaticDeactivations: Effect.Effect<readonly StoredAutomaticDeactivation[], StorageUnavailable>;
  readonly insert: (record: NewAutomaticDeactivation) => Fails<StoredAutomaticDeactivation>;
  readonly markRead: (ids: readonly AutomaticDeactivationId[]) => Fails<void>;
}

interface AutomaticDeactivationsSection {
  readonly deactivateQuietAgents: (now: IsoTime, days: QuietDays) => Fails<readonly StoredAutomaticDeactivation[]>;
  readonly listAutomaticDeactivations: (recipient: IdentityName) => Fails<readonly StoredAutomaticDeactivation[]>;
  readonly markAutomaticDeactivationRead: (
    recipient: IdentityName,
    id: AutomaticDeactivationId,
  ) => Fails<StoredAutomaticDeactivation | null>;
  readonly markAutomaticDeactivationsReadUpTo: (
    recipient: IdentityName,
    upTo: AutomaticDeactivationId,
  ) => Fails<readonly StoredAutomaticDeactivation[]>;
  readonly readAutomaticDeactivationsOf: (identity: IdentityName) => Fails<readonly StoredAutomaticDeactivation[]>;
}

interface DeactivationsOn {
  readonly board: Effect.Effect<Board, StorageUnavailable>;
  readonly records: AutomaticDeactivationRecords;
  readonly deactivate: (name: IdentityName) => Fails<boolean>;
}

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function asRead(record: StoredAutomaticDeactivation): StoredAutomaticDeactivation {
  return { ...record, read: true };
}

function deactivateOne(
  on: DeactivationsOn,
  board: Board,
  now: IsoTime,
): (agent: Identity) => Fails<readonly StoredAutomaticDeactivation[]> {
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
): Fails<readonly StoredAutomaticDeactivation[]> {
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
  reading: (record: StoredAutomaticDeactivation) => boolean,
): Fails<readonly StoredAutomaticDeactivation[]> {
  return Effect.gen(function* readEntries() {
    const all = yield* on.records.automaticDeactivations;
    const unread = Arr.filter(all, (record) => !record.read && reading(record));
    yield* on.records.markRead(Arr.map(unread, ({ id }) => id));
    return Arr.map(unread, asRead);
  });
}

function sentTo(recipient: IdentityName): (record: StoredAutomaticDeactivation) => boolean {
  return (record) => record.recipients.includes(recipient);
}

function markOneRead(
  on: DeactivationsOn,
  recipient: IdentityName,
  id: AutomaticDeactivationId,
): Fails<StoredAutomaticDeactivation | null> {
  return Effect.gen(function* markEntryRead() {
    const all = yield* on.records.automaticDeactivations;
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

function automaticDeactivationsOn(on: DeactivationsOn): AutomaticDeactivationsSection {
  return {
    deactivateQuietAgents: (now, days) => deactivateQuiet(on, now, days),
    listAutomaticDeactivations: (recipient) =>
      Effect.map(on.records.automaticDeactivations, (all) => Arr.filter(all, sentTo(recipient))),
    markAutomaticDeactivationRead: (recipient, id) => markOneRead(on, recipient, id),
    markAutomaticDeactivationsReadUpTo: (recipient, upTo) =>
      readWhere(on, (record) => record.id <= upTo && sentTo(recipient)(record)),
    readAutomaticDeactivationsOf: (identity) => readWhere(on, (record) => record.identity === identity),
  };
}

export {
  type AutomaticDeactivationRecords,
  type AutomaticDeactivationsSection,
  type NewAutomaticDeactivation,
  type StoredAutomaticDeactivation,
  automaticDeactivationsOn,
  deactivatingWith,
};
