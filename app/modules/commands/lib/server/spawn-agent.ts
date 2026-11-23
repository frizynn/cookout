import { Array as Arr, Context, DateTime, Option, Order, Predicate, String as Str } from "effect";
import type { BuiltInCommand, CallCommandResponse, Command, JsonSchema, RegisteredCommand } from "../../index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { builtInCommandNames, isCommandName, spawnAgentCommandName } from "../../index.ts";
import type { Description } from "../../../identities/client.ts";
import type { Effect } from "effect";
import type { JsonValue } from "../../../messages/index.ts";
import type { Messages } from "../../../messages/server.ts";
import type { Refusal } from "../../../http/index.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isDescription } from "../../../identities/client.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

type PostMessage = Messages["Service"]["post"] extends (author: Identity, message: infer Sent) => unknown
  ? Sent
  : never;

interface SpawnCall {
  readonly caller: Identity;
  readonly message: PostMessage;
  readonly data: JsonValue;
}

interface SpawnTask {
  readonly name: IdentityName;
  readonly task: Description;
}

interface SpawningService {
  readonly spawn: (call: SpawnCall) => Effect.Effect<CallCommandResponse, Refusal | StorageUnavailable>;
}

class Spawning extends Context.Service<Spawning, SpawningService>()(
  "@ai-hero/cookout/commands/lib/server/spawn-agent/Spawning",
) {}

const TASK_LENGTH = { maximum: 500, minimum: 1 } as const;
const EPOCH_MILLIS = 0;

const spawnAgentSchema: JsonSchema = {
  additionalProperties: false,
  properties: {
    name: {
      description: "The new agent's name, such as fixer: 1-64 lowercase letters, digits or '-', or <you>/<name>.",
      pattern: "^[a-z0-9-]{1,64}(?:/[a-z0-9-]{1,64})?$",
      type: "string",
    },
    task: {
      description: "What the agent should do. It also becomes the agent's description.",
      maxLength: TASK_LENGTH.maximum,
      minLength: TASK_LENGTH.minimum,
      pattern: String.raw`\S`,
      type: "string",
    },
  },
  required: ["name", "task"],
  type: "object",
};

const handlerName = Option.getOrThrow(Option.liftPredicate(spawnAgentCommandName, isIdentityName));

const commandName = Option.getOrThrow(Option.liftPredicate(spawnAgentCommandName, isCommandName));

const spawnAgentCommand: BuiltInCommand = {
  builtIn: true,
  createdAt: isoTimeOf(DateTime.makeUnsafe(EPOCH_MILLIS)),
  description: "Start a remote Claude Code session that works on this board as a new agent you own.",
  handler: handlerName,
  name: commandName,
  schema: spawnAgentSchema,
};

const byName: Order.Order<Command> = Order.mapInput(Order.String, (command: Command) => command.name);

function withBuiltInCommands(registered: readonly RegisteredCommand[]): readonly Command[] {
  const others = Arr.filter(registered, ({ name }) => !Arr.contains(builtInCommandNames, name));
  const listed: readonly Command[] = others;
  return Arr.sort(Arr.append(listed, spawnAgentCommand), byName);
}

function fieldOf(data: JsonValue, key: "name" | "task"): Option.Option<string> {
  return Option.liftPredicate(data, (value) => Predicate.hasProperty(value, key)).pipe(
    Option.map((value) => value[key]),
    Option.filter(Predicate.isString),
  );
}

function spawnTaskOf(data: JsonValue): Option.Option<SpawnTask> {
  const name = Option.filter(fieldOf(data, "name"), isIdentityName);
  const task = Option.filter(Option.map(fieldOf(data, "task"), Str.trim), isDescription);
  return Option.all({ name, task });
}

export { Spawning, spawnAgentCommand, spawnTaskOf, withBuiltInCommands };
export type { PostMessage, SpawnCall, SpawnTask, SpawningService };
