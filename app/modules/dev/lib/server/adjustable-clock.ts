import { Clock, Duration, Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import type { Scope } from "effect";
import { clockForwardPath } from "../../../http/index.ts";
import { flow } from "effect/Function";

interface AdjustableClock {
  readonly clock: Clock.Clock;
  readonly url: string;
}

interface LiveTime {
  readonly millis: () => number;
  readonly nanos: () => bigint;
  readonly monotonicNanos: () => bigint;
  readonly sleepMillis: (millis: number) => Effect.Effect<void>;
}

interface Ahead {
  readonly live: LiveTime;
  readonly offsetMillis: () => number;
  readonly movedFrom: (seen: number) => Effect.Effect<void>;
  readonly moveForwardMillis: (millis: number) => Effect.Effect<void>;
}

type Answer = Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest>;

const LISTEN = { host: "127.0.0.1", port: 0 } as const;
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const DUE = 0;
const NANOS_PER_MILLI = 1_000_000n;
const ClockForward = Schema.Struct({ days: Schema.Finite.check(Schema.isGreaterThan(DUE)) });

function sleepUntil(ahead: Ahead, wakeAt: number): Effect.Effect<void> {
  return Effect.suspend(() => {
    const seen = ahead.offsetMillis();
    const left = wakeAt - (ahead.live.millis() + seen);
    if (left <= DUE) {
      return Effect.void;
    }
    const woken = Effect.raceFirst(ahead.live.sleepMillis(left), ahead.movedFrom(seen));
    return Effect.andThen(woken, sleepUntil(ahead, wakeAt));
  });
}

function clockAhead(ahead: Ahead): Clock.Clock {
  const { live, offsetMillis } = ahead;
  function nowMillis(): number {
    return live.millis() + offsetMillis();
  }
  function offsetNanos(): bigint {
    return BigInt(offsetMillis()) * NANOS_PER_MILLI;
  }
  function nowNanos(): bigint {
    return live.nanos() + offsetNanos();
  }
  function monotonicNanos(): bigint {
    return live.monotonicNanos() + offsetNanos();
  }
  return {
    currentTimeMillis: Effect.sync(nowMillis),
    currentTimeMillisUnsafe: nowMillis,
    currentTimeNanos: Effect.sync(nowNanos),
    currentTimeNanosUnsafe: nowNanos,
    monotonicTimeNanos: Effect.sync(monotonicNanos),
    monotonicTimeNanosUnsafe: monotonicNanos,
    sleep: flow(Duration.toMillis, (millis) => Effect.suspend(() => sleepUntil(ahead, nowMillis() + millis))),
  };
}

function controlled(ahead: Ahead): Answer {
  return Effect.gen(function* answerControl() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.method !== "POST" || request.url !== clockForwardPath) {
      return HttpServerResponse.empty({ status: NOT_FOUND });
    }
    const { days } = yield* HttpServerRequest.schemaBodyJson(ClockForward);
    yield* ahead.moveForwardMillis(Duration.toMillis(Duration.days(days)));
    return HttpServerResponse.empty({ status: NO_CONTENT });
  }).pipe(Effect.orDie);
}

function adjustableClock(): Effect.Effect<AdjustableClock, never, Scope.Scope> {
  return Effect.gen(function* openAdjustableClock() {
    const clock = yield* Clock.Clock;
    const offset = yield* SubscriptionRef.make(DUE);
    const ahead: Ahead = {
      live: {
        millis: () => clock.currentTimeMillisUnsafe(),
        monotonicNanos: () => clock.monotonicTimeNanosUnsafe(),
        nanos: () => clock.currentTimeNanosUnsafe(),
        sleepMillis: (millis) => clock.sleep(Duration.millis(millis)),
      },
      moveForwardMillis: (by) => SubscriptionRef.update(offset, (millis) => millis + by),
      movedFrom: (seen) =>
        SubscriptionRef.changes(offset).pipe(
          Stream.filter((millis) => millis !== seen),
          Stream.runHead,
          Effect.asVoid,
        ),
      offsetMillis: () => SubscriptionRef.getUnsafe(offset),
    };
    const serving = HttpServer.serve(controlled(ahead)).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
    const server = yield* Layer.build(serving);
    const url = yield* Effect.provideContext(serverUrl, server);
    return { clock: clockAhead(ahead), url };
  }).pipe(Effect.orDie);
}

export { type AdjustableClock, adjustableClock };
