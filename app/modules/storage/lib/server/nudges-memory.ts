import { Array as Arr, DateTime, Effect, Option, Ref } from "effect";
import type { NudgeRecord, NudgeRecords, NudgeSources, NudgesSection } from "./nudges.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { MemoryState } from "./memory-state.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { NudgeId } from "../../../inbox/index.ts";
import type { Scope } from "effect";
import { isNudgeId } from "../../../inbox/index.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { nudgesOn } from "./nudges.ts";
import { openMemoryState } from "./memory-state.ts";

interface Kept {
  readonly last: number;
  readonly records: readonly NudgeRecord[];
}

interface Marking {
  readonly ids: readonly NudgeId[];
  readonly recipient: IdentityName;
}

const NEXT = 1;
const EMPTY: Kept = { last: 0, records: [] };

function asNudgeId(value: number): NudgeId {
  return Option.getOrThrow(Option.liftPredicate(value, isNudgeId));
}

function latestPerThread(records: readonly NudgeRecord[]): readonly NudgeRecord[] {
  const latest = new Map<MessageId, NudgeRecord>(Arr.map(records, (record) => [record.thread, record] as const));
  return [...latest.values()];
}

function markedIn(data: Kept, { ids, recipient }: Marking): Kept {
  const records = Arr.map(data.records, (record) => {
    if (record.recipient === recipient && ids.includes(record.id)) {
      return { ...record, read: true };
    }
    return record;
  });
  return { ...data, records };
}

function inserted(data: Kept, record: Omit<NudgeRecord, "id" | "read">): readonly [NudgeRecord, Kept] {
  const stored: NudgeRecord = { ...record, id: asNudgeId(data.last + NEXT), read: false };
  return [stored, { last: data.last + NEXT, records: [...data.records, stored] }];
}

function memoryRecords(state: MemoryState): Effect.Effect<NudgeRecords> {
  return Effect.gen(function* openNudgeRecords() {
    const now = yield* DateTime.now;
    const since = isoTimeOf(now);
    const kept = yield* Ref.make(EMPTY);
    function read<Value>(work: (data: Kept) => Value): Effect.Effect<Value, Effect.Error<typeof state.ensureOpen>> {
      return Effect.andThen(state.ensureOpen, Effect.map(Ref.get(kept), work));
    }
    return {
      insert: (record) =>
        Effect.andThen(
          state.ensureOpen,
          Ref.modify(kept, (data) => inserted(data, record)),
        ),
      latestPerThread: read((data) => latestPerThread(data.records)),
      markRead: (recipient, ids) =>
        Effect.andThen(
          state.ensureOpen,
          Ref.update(kept, (data) => markedIn(data, { ids, recipient })),
        ),
      ofRecipient: (recipient) => read((data) => Arr.filter(data.records, (record) => record.recipient === recipient)),
      since: Effect.as(state.ensureOpen, since),
    };
  });
}

function memoryNudges(sources: NudgeSources): Effect.Effect<NudgesSection, never, Scope.Scope> {
  return Effect.gen(function* openMemoryNudges() {
    const state = yield* openMemoryState;
    const records = yield* memoryRecords(state);
    return nudgesOn({ atomically: (work) => work, identities: sources, messages: sources, records });
  });
}

export { memoryNudges };
