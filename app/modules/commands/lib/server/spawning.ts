import { Array as Arr, Context, Effect, FiberSet, Layer, Option, Redacted } from "effect";
import type { Config, Scope } from "effect";
import type { ReplyNeeds, SpawnThread } from "./spawn-replies.ts";
import { RoutineFire, routineFireLayer } from "./routine.ts";
import type { SpawnCall, SpawnTask, SpawningService } from "./spawn-agent.ts";
import { Spawning, spawnTaskOf } from "./spawn-agent.ts";
import { deactivated, replierIn } from "./spawn-replies.ts";
import { routineFireUrl, routineToken, webhookTimeoutSeconds } from "../../../config/server.ts";
import { AgentSessions } from "../../../agent-sessions/server.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import { Messages } from "../../../messages/server.ts";
import type { Routine } from "./routine.ts";

interface SpawnSettingsService {
  readonly publicUrl: string;
  readonly adminName: IdentityName;
}

class SpawnSettings extends Context.Service<SpawnSettings, SpawnSettingsService>()(
  "@ai-hero/cookout/commands/lib/server/spawning/SpawnSettings",
) {}

type SpawnNeeds = ReplyNeeds | AgentSessions | IdentityChanges | RoutineFire;

interface Setup {
  readonly routine: Option.Option<Routine>;
  readonly board: string;
  readonly adminName: IdentityName;
}

interface Spawn {
  readonly caller: SpawnCall["caller"];
  readonly thread: SpawnThread;
  readonly task: SpawnTask;
}

interface Made {
  readonly spawn: Spawn;
  readonly routine: Routine;
  readonly joinCode: string;
}

const LINES = "\n";

const notSetUp =
  "Spawning is not set up on this board: it needs COOKOUT_ROUTINE_FIRE_URL, COOKOUT_ROUTINE_TOKEN and " +
  "COOKOUT_PUBLIC_URL. See docs/routines/README.md.";

const humanOnly = "Only a human can spawn an agent, since the agent is owned by whoever spawns it.";

function fireText(board: string, { joinCode, spawn }: Omit<Made, "routine">): string {
  const { task, thread } = spawn;
  return Arr.join(
    [
      `board: ${board}`,
      `agent: ${task.name}`,
      `join code: ${joinCode}`,
      `channel: ${thread.channel}`,
      `thread: ${thread.threadId}`,
      `task: ${task.task}`,
    ],
    LINES,
  );
}

function fired(setup: Setup, made: Made): Effect.Effect<string, never, SpawnNeeds> {
  const { name } = made.spawn.task;
  const { caller } = made.spawn;
  const fire = Effect.flatMap(RoutineFire, (routines) =>
    routines.fire({ routine: made.routine, text: fireText(setup.board, made) }),
  );
  return Effect.matchEffect(fire, {
    onFailure: (why) =>
      Effect.as(deactivated(name), `The routine didn't start a session (${why}), so @${name} is deactivated.`),
    onSuccess: (url) => Effect.succeed(`Spawned @${name}, owned by @${caller.name}, in the session ${url}`),
  });
}

function spawnWith(setup: Setup, spawn: Spawn, routine: Routine): Effect.Effect<string, never, SpawnNeeds> {
  const { caller, task } = spawn;
  if (caller.kind !== "human") {
    return Effect.succeed(humanOnly);
  }
  return Effect.flatMap(AgentSessions, (agentSessions) =>
    agentSessions.createJoinCode({ caller, description: task.task, name: task.name }).pipe(
      Effect.matchEffect({
        onFailure: (refused: { readonly message: string }) =>
          Effect.succeed(`@${task.name} couldn't be made: ${refused.message}`),
        onSuccess: ({ joinCode }) => fired(setup, { joinCode, routine, spawn }),
      }),
    ),
  );
}

function spawnIn(setup: Setup, spawn: Spawn): Effect.Effect<void, never, SpawnNeeds> {
  const answer = Option.match(setup.routine, {
    onNone: () => Effect.succeed(notSetUp),
    onSome: (routine) => spawnWith(setup, spawn, routine),
  });
  return Effect.flatMap(answer, replierIn({ adminName: setup.adminName, thread: spawn.thread }));
}

const readSetup: Effect.Effect<Setup, Config.ConfigError, SpawnSettings> = Effect.gen(function* readSpawnSetup() {
  const { adminName, publicUrl } = yield* SpawnSettings;
  const fireUrl = yield* routineFireUrl;
  const token = yield* routineToken;
  const timeoutSeconds = yield* webhookTimeoutSeconds;
  const configured = fireUrl !== "" && Redacted.value(token) !== "" && publicUrl !== "";
  const routine = Option.liftPredicate({ fireUrl, timeoutSeconds, token }, () => configured);
  return { adminName, board: publicUrl, routine };
});

function spawnerOn(setup: Setup): Effect.Effect<SpawningService, never, Messages | SpawnNeeds | Scope.Scope> {
  return Effect.gen(function* startSpawning() {
    const running = yield* FiberSet.make();
    const runInBackground = yield* FiberSet.runtime(running)<SpawnNeeds>();
    const messages = yield* Messages;
    function spawn({ caller, data, message }: SpawnCall): ReturnType<SpawningService["spawn"]> {
      return Effect.gen(function* postThenSpawn() {
        const task = yield* Effect.orDie(Effect.fromOption(spawnTaskOf(data)));
        const posted = yield* messages.post(caller, message);
        const threadId = posted.message.id;
        const thread = { channel: posted.message.channel, threadId };
        runInBackground(spawnIn(setup, { caller, task, thread }));
        return { messageId: threadId, threadId };
      });
    }
    return Spawning.of({ spawn });
  });
}

const spawningLayer: Layer.Layer<Spawning, Config.ConfigError, SpawnSettings | Exclude<SpawnNeeds, RoutineFire>> =
  Layer.effect(Spawning, Effect.flatMap(readSetup, spawnerOn)).pipe(Layer.provide(routineFireLayer));

export { SpawnSettings, spawningLayer };
