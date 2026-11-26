import { Array as Arr, Effect, Option, Predicate, Record, Schema } from "effect";
import type { ChannelRouting, FallbackWake, SetChannelRoutingRequest, WakeOptions } from "../../index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { WakeOptionsSchema } from "./wire.ts";
import { defaultWakeOptions } from "../../index.ts";
import { echoed } from "../../../http/index.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { wakeOptionsSetting } from "../../../config/server.ts";

const UNPROCESSABLE = 422;

interface AskedRouting {
  readonly asked: SetChannelRoutingRequest;
  readonly storage: Storage["Service"];
  readonly wakeOptions: WakeOptions;
}

interface AskedWake {
  readonly options: WakeOptions;
  readonly asked: FallbackWake | undefined;
}

function isListed(options: WakeOptions, wake: FallbackWake): boolean {
  const harness = Arr.findFirst(options.harnesses, ({ name }) => name === wake.harness);
  return Option.exists(
    harness,
    ({ efforts, models }) => Arr.some(models, ({ name }) => name === wake.model) && efforts.includes(wake.effort),
  );
}

function unlisted({ effort, harness, model }: FallbackWake): Refusal {
  return {
    code: "routing_wake_invalid",
    message: `This board's wake options don't list the harness ${echoed(harness)} with the model ${echoed(model)} and the effort ${echoed(effort)}.`,
    status: UNPROCESSABLE,
  };
}

const wakeOptionsOf: Effect.Effect<WakeOptions> = Effect.orDie(
  wakeOptionsSetting({ read: Schema.fromJsonString(WakeOptionsSchema), unset: defaultWakeOptions }),
);

function checkedWake({ asked, options }: AskedWake): Effect.Effect<Option.Option<FallbackWake>, Refusal> {
  return Option.match(Option.fromUndefinedOr(asked), {
    onNone: () => Effect.succeedNone,
    onSome: (wake) => {
      if (!isListed(options, wake)) {
        return Effect.fail(unlisted(wake));
      }
      return Effect.succeedSome({ effort: wake.effort, harness: wake.harness, model: wake.model });
    },
  });
}

function notAnAgent(name: string): Refusal {
  return {
    code: "routing_agent_invalid",
    message: `${echoed(name)} isn't an active agent, so it can't own a channel or be its fallback.`,
    status: UNPROCESSABLE,
  };
}

const ownerAndRouter: Refusal = {
  code: "routing_conflict",
  message: "A channel has an owner or a router, not both; a fallback needs a router, and a fallback wake a fallback.",
  status: UNPROCESSABLE,
};

function activeAgent(
  storage: Storage["Service"],
  asked: string,
): Effect.Effect<IdentityName, Refusal | StorageUnavailable> {
  if (!isIdentityName(asked)) {
    return Effect.fail(notAnAgent(asked));
  }
  return Effect.flatMap(storage.findIdentityByName(asked), (found) => {
    if (Predicate.isUndefined(found) || found.kind !== "agent" || found.deactivated === true) {
      return Effect.fail(notAnAgent(asked));
    }
    return Effect.succeed(found.name);
  });
}

function checkedAgent(
  storage: Storage["Service"],
  asked: string | undefined,
): Effect.Effect<Option.Option<IdentityName>, Refusal | StorageUnavailable> {
  return Option.match(Option.fromUndefinedOr(asked), {
    onNone: () => Effect.succeedNone,
    onSome: (name) => Effect.asSome(activeAgent(storage, name)),
  });
}

function present<Key extends string>(key: Key): <Value>(value: Option.Option<Value>) => Partial<Record<Key, Value>> {
  return (value) =>
    Option.match(value, {
      onNone: () => ({}),
      onSome: (found) => Record.singleton(key, found),
    });
}

function routerConflict({ fallback, owner, router }: SetChannelRoutingRequest): boolean {
  const hasRouter = Predicate.isNotUndefined(router);
  return (Predicate.isNotUndefined(owner) && hasRouter) || (Predicate.isNotUndefined(fallback) && !hasRouter);
}

function conflicting(asked: SetChannelRoutingRequest): boolean {
  return (
    routerConflict(asked) || (Predicate.isNotUndefined(asked.fallbackWake) && Predicate.isUndefined(asked.fallback))
  );
}

function checkedRouting({
  asked,
  storage,
  wakeOptions,
}: AskedRouting): Effect.Effect<ChannelRouting, Refusal | StorageUnavailable> {
  if (conflicting(asked)) {
    return Effect.fail(ownerAndRouter);
  }
  return Effect.gen(function* checkRouting() {
    const owner = yield* checkedAgent(storage, asked.owner);
    const fallback = yield* checkedAgent(storage, asked.fallback);
    const fallbackWake = yield* checkedWake({ asked: asked.fallbackWake, options: wakeOptions });
    return {
      ...present("owner")(owner),
      ...present("router")(Option.fromUndefinedOr(asked.router)),
      ...present("fallback")(fallback),
      ...present("fallbackWake")(fallbackWake),
    };
  });
}

export { checkedRouting, present, wakeOptionsOf };
