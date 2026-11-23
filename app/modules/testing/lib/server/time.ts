import { DateTime, Effect, Option } from "effect";
import type { IsoTime } from "../../../time/index.ts";
import { TestClock } from "effect/testing";
import { isIsoTime } from "../../../time/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

function isoTime(value: string): IsoTime {
  return Option.getOrThrow(Option.liftPredicate(value, isIsoTime));
}

const testStartTime: IsoTime = isoTime("2026-01-01T00:00:00.000Z");

const fixtureTime: IsoTime = testStartTime;

const startTestClock: Effect.Effect<void> = TestClock.setTime(
  DateTime.toEpochMillis(DateTime.makeUnsafe(testStartTime)),
);

const currentTime: Effect.Effect<IsoTime> = Effect.map(DateTime.now, isoTimeOf);

export { currentTime, fixtureTime, isoTime, startTestClock, testStartTime };
