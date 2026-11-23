import type { Command, CommandWithSecretResponse } from "../../index.ts";
import { DateTime, Effect, Option } from "effect";
import type { AddCommandRequestSchema } from "./wire.ts";
import type { AgentIdentity } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { requireDataSchema } from "./call.ts";

type NewCommand = typeof AddCommandRequestSchema.Type;

const CONFLICT = 409;

function commandExists(name: string): Refusal {
  return { code: "command_exists", message: `The command ${name} already exists.`, status: CONFLICT };
}

function handlerNotAgent(name: string): Refusal {
  return {
    code: "handler_not_agent",
    message: `${name} is a human. A command's handler identity has the command's name and must be an agent.`,
    status: CONFLICT,
  };
}

function stamped(fields: NewCommand, createdAt: IsoTime): Command {
  const handler = Option.getOrThrow(Option.liftPredicate(fields.name, isIdentityName));
  const command = { createdAt, handler, name: fields.name, schema: fields.schema, url: fields.url };
  if (typeof fields.description === "string") {
    return { ...command, description: fields.description };
  }
  return command;
}

function handlerOf(command: Command): AgentIdentity {
  return { admin: false, createdAt: command.createdAt, kind: "agent", name: command.handler };
}

function addCommand(
  fields: NewCommand,
): Effect.Effect<CommandWithSecretResponse, Refusal | StorageUnavailable, Storage | Secrets> {
  return Effect.gen(function* addStampedCommand() {
    const command = yield* Effect.andThen(
      requireDataSchema(fields.schema),
      Effect.map(DateTime.now, (now) => stamped(fields, isoTimeOf(now))),
    );
    const secrets = yield* Secrets;
    const secret = yield* secrets.newCommandSecret;
    const storage = yield* Storage;
    const result = yield* storage.addCommand({ command, secret }, handlerOf(command));
    if (result === "name_taken") {
      return yield* Effect.fail(commandExists(command.name));
    }
    if (result === "handler_is_human") {
      return yield* Effect.fail(handlerNotAgent(command.name));
    }
    return { command, secret };
  });
}

export { addCommand };
