import { Array as Arr, Context, Effect, Layer, Option, Queue, Ref } from "effect";
import type { RouterAsk, RouterCallerService, RouterPick } from "../../../channels/server.ts";
import type { TriggerAnswer, TriggerCall, TriggerCallerService } from "../../../triggers/server.ts";
import { RouterCaller } from "../../../channels/server.ts";
import { TriggerCaller } from "../../../triggers/server.ts";
import type { TriggerToken } from "../../../triggers/index.ts";
import { isTriggerToken } from "../../../triggers/index.ts";

type ScriptedAnswer = { readonly status: number; readonly message?: string } | { readonly error: string } | "no answer";

type ScriptedRoute = { readonly agents: readonly RouterPick[] } | { readonly error: string } | "no answer";

interface ScriptedTriggersService {
  readonly answerNext: (answers: readonly ScriptedAnswer[]) => Effect.Effect<void>;
  readonly routeWith: (route: ScriptedRoute) => Effect.Effect<void>;
  readonly routerCalls: Effect.Effect<readonly RouterAsk[]>;
  readonly calls: Effect.Effect<readonly TriggerCall[]>;
  readonly waitForCalls: (count: number) => Effect.Effect<readonly TriggerCall[]>;
}

class ScriptedTriggers extends Context.Service<ScriptedTriggers, ScriptedTriggersService>()(
  "@ai-hero/cookout/webhook-fake/lib/server/scripted-triggers/ScriptedTriggers",
) {}

const OK: ScriptedAnswer = { status: 200 };
const ONE = 1;

function answered(answer: ScriptedAnswer): Effect.Effect<TriggerAnswer, string> {
  if (answer === "no answer") {
    return Effect.never;
  }
  if ("status" in answer) {
    return Effect.succeed({ message: answer.message ?? "", status: answer.status });
  }
  return Effect.fail(answer.error);
}

function routed(route: ScriptedRoute): Effect.Effect<readonly RouterPick[], string> {
  if (route === "no answer") {
    return Effect.never;
  }
  if ("error" in route) {
    return Effect.fail(route.error);
  }
  return Effect.succeed(route.agents);
}

interface Scripted {
  readonly router: RouterCallerService;
  readonly caller: TriggerCallerService;
  readonly service: ScriptedTriggersService;
}

const scripted: Effect.Effect<Scripted> = Effect.gen(function* openScriptedTriggers() {
  const made = yield* Ref.make<readonly TriggerCall[]>([]);
  const arrived = yield* Queue.unbounded<true>();
  const script = yield* Ref.make<readonly ScriptedAnswer[]>([]);
  const route = yield* Ref.make<ScriptedRoute>({ agents: [] });
  const asked = yield* Ref.make<readonly RouterAsk[]>([]);
  const router: RouterCallerService = {
    ask: (ask) =>
      Effect.andThen(
        Ref.update(asked, (calls) => [...calls, ask]),
        Effect.flatMap(Ref.get(route), routed),
      ),
  };
  const nextAnswer = Ref.modify(
    script,
    (left) => [Option.getOrElse(Arr.head(left), () => OK), Arr.drop(left, ONE)] as const,
  );
  const caller: TriggerCallerService = {
    call: (call) =>
      Effect.gen(function* answerScripted() {
        yield* Ref.update(made, (calls) => [...calls, call]);
        yield* Queue.offer(arrived, true);
        return yield* Effect.flatMap(nextAnswer, answered);
      }),
  };
  const service: ScriptedTriggersService = {
    answerNext: (answers) => Ref.update(script, (left) => [...left, ...answers]),
    calls: Ref.get(made),
    routeWith: (next) => Ref.set(route, next),
    routerCalls: Ref.get(asked),
    waitForCalls: (count) =>
      Ref.get(made).pipe(
        Effect.tap((calls) => Effect.when(Queue.take(arrived), Effect.succeed(calls.length < count))),
        Effect.repeat({ until: (calls) => calls.length >= count }),
      ),
  };
  return { caller, router, service };
});

const scriptedTriggers: Layer.Layer<ScriptedTriggers | TriggerCaller | RouterCaller> = Layer.effectContext(
  Effect.map(scripted, ({ caller, router, service }) =>
    Context.make(ScriptedTriggers, service).pipe(Context.add(TriggerCaller, caller), Context.add(RouterCaller, router)),
  ),
);

const unusedScriptedTriggers: Layer.Layer<ScriptedTriggers> = Layer.effect(
  ScriptedTriggers,
  Effect.map(scripted, ({ service }) => service),
);

function triggerToken(value: string): TriggerToken {
  return Option.getOrThrow(Option.liftPredicate(value, isTriggerToken));
}

export {
  type ScriptedAnswer,
  type ScriptedRoute,
  ScriptedTriggers,
  type ScriptedTriggersService,
  scriptedTriggers,
  triggerToken,
  unusedScriptedTriggers,
};
