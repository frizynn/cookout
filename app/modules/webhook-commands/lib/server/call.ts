import { Array as Arr, Effect, Predicate, Result } from "effect";
import type { CallCommandResponse, Command, CommandName, JsonSchema } from "../../index.ts";
import type { DataCheck, DataError } from "./data-schema.ts";
import type { StorageUnavailable, StoredCommand } from "../../../storage/server.ts";
import type { CallCommandRequestSchema } from "./wire.ts";
import { Deliveries } from "./delivery.ts";
import type { Identity } from "../../../identities/index.ts";
import { Messages } from "../../../messages/server.ts";
import type { Refusal } from "../../../http/index.ts";
import { Storage } from "../../../storage/server.ts";
import { compileDataSchema } from "./data-schema.ts";
import { echoed } from "../../../http/index.ts";
import { isCommandName } from "../../index.ts";
import { sentHarness } from "../../../identities/server.ts";

type CallNeeds = Storage | Messages | Deliveries;

type Refused = Refusal | StorageUnavailable;

interface CommandCall extends Readonly<typeof CallCommandRequestSchema.Type> {
  readonly caller: Identity;
  readonly name: string;
}

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const INTERNAL_ERROR = 500;
const MESSAGE = 1;

function commandNotFound(name: string): Refusal {
  return { code: "command_not_found", message: `There is no command ${echoed(name)}.`, status: NOT_FOUND };
}

function dataRefused(name: CommandName, errors: readonly DataError[]): Refusal {
  return {
    code: "invalid_request",
    details: Arr.map(errors, ({ message, path }) => ({ message, path: ["data", ...path] })),
    message: `The data doesn't follow the schema of the command ${name}.`,
    status: BAD_REQUEST,
  };
}

function schemaRefused(message: string): Refusal {
  return {
    code: "invalid_request",
    details: [{ message, path: ["schema"] }],
    message: "The schema is not a JSON Schema the server can check data with.",
    status: BAD_REQUEST,
  };
}

function requireDataSchema(schema: JsonSchema): Effect.Effect<void, Refusal> {
  return Result.match(compileDataSchema(schema), {
    onFailure: (message) => Effect.fail(schemaRefused(message)),
    onSuccess: () => Effect.void,
  });
}

function storedCheck({ name, schema }: Command): Effect.Effect<DataCheck, Refusal> {
  return Result.match(compileDataSchema(schema), {
    onFailure: (message) =>
      Effect.fail({
        code: "internal_error",
        message: `The stored schema of the command ${name} doesn't compile: ${message}`,
        status: INTERNAL_ERROR,
      }),
    onSuccess: Effect.succeed,
  });
}

function storedCommand(name: string): Effect.Effect<StoredCommand, Refused, Storage> {
  return Effect.gen(function* findCommand() {
    if (!isCommandName(name)) {
      return yield* Effect.fail(commandNotFound(name));
    }
    const storage = yield* Storage;
    const stored = yield* storage.findCommand(name);
    if (Predicate.isUndefined(stored)) {
      return yield* Effect.fail(commandNotFound(name));
    }
    return stored;
  });
}

function requireData(command: Command, data: CommandCall["data"]): Effect.Effect<void, Refusal> {
  return Effect.flatMap(storedCheck(command), (check) => {
    const errors = check(data);
    if (Arr.isReadonlyArrayNonEmpty(errors)) {
      return Effect.fail(dataRefused(command.name, errors));
    }
    return Effect.void;
  });
}

type CallMessage = Parameters<Messages["Service"]["postCommandCall"]>[typeof MESSAGE];

function callMessageOf(
  name: CommandName,
  { channel, data }: Pick<CommandCall, "channel" | "data">,
): Effect.Effect<CallMessage> {
  return Effect.map(sentHarness, (tool) => ({ ...tool, channel, data: { command: name, data }, text: `/${name}` }));
}

function callCommand(call: CommandCall): Effect.Effect<CallCommandResponse, Refused, CallNeeds> {
  const { caller, channel, data, name } = call;
  return Effect.gen(function* postCall() {
    const stored = yield* storedCommand(name);
    const { command } = stored;
    yield* requireData(command, data);
    const messages = yield* Messages;
    const deliveries = yield* Deliveries;
    const callMessage = yield* callMessageOf(command.name, { channel, data });
    const { threadId } = yield* deliveries.deliver({ data, stored }, (parts) =>
      Effect.map(messages.postCommandCall(caller, callMessage, parts), ({ message }) => ({
        channel: message.channel,
        threadId: message.id,
      })),
    );
    return { messageId: threadId, threadId };
  });
}

export { type CallNeeds, callCommand, commandNotFound, requireDataSchema };
export { deliveriesLayer } from "./delivery.ts";
