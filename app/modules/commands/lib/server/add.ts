import type { CommandWithSecretResponse, RegisteredCommand } from "../../index.ts";
import { DateTime, Effect, Option, Predicate } from "effect";
import { commandNotFound, requireDataSchema } from "./call.ts";
import { handlerOf, isCommandName } from "../../index.ts";
import type { AddCommandRequestSchema } from "./wire.ts";
import type { CommandChanges } from "./changes.ts";
import type { Owner } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { announced } from "./changes.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

type NewCommand = typeof AddCommandRequestSchema.Type;

type AddNeeds = Storage | Secrets | CommandChanges;

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

function stamped(fields: NewCommand, createdAt: RegisteredCommand["createdAt"]): RegisteredCommand {
  const handler = Option.getOrThrow(Option.liftPredicate(fields.name, isIdentityName));
  const command = { createdAt, handler, name: fields.name, schema: fields.schema, url: fields.url };
  if (typeof fields.description === "string") {
    return { ...command, description: fields.description };
  }
  return command;
}

function addCommand({
  fields,
  owner,
}: {
  readonly fields: NewCommand;
  readonly owner: Owner;
}): Effect.Effect<CommandWithSecretResponse, Refusal | StorageUnavailable, AddNeeds> {
  return Effect.gen(function* addStampedCommand() {
    const command = yield* requireDataSchema(fields.schema).pipe(
      Effect.andThen(Effect.map(DateTime.now, (now) => stamped(fields, isoTimeOf(now)))),
    );
    const secrets = yield* Secrets;
    const secret = yield* secrets.newCommandSecret;
    const storage = yield* Storage;
    const result = yield* storage.addCommand({ command, secret }, handlerOf({ command, owner }));
    if (result === "name_taken") {
      return yield* Effect.fail(commandExists(command.name));
    }
    if (result === "handler_is_human") {
      return yield* Effect.fail(handlerNotAgent(command.name));
    }
    return yield* announced({ command, secret });
  });
}

function rotateCommandSecret(
  name: string,
): Effect.Effect<CommandWithSecretResponse, Refusal | StorageUnavailable, AddNeeds> {
  return Effect.gen(function* rotateSecret() {
    if (!isCommandName(name)) {
      return yield* Effect.fail(commandNotFound(name));
    }
    const secrets = yield* Secrets;
    const secret = yield* secrets.newCommandSecret;
    const storage = yield* Storage;
    const rotated = yield* storage.replaceCommandSecret(name, secret);
    if (Predicate.isUndefined(rotated)) {
      return yield* Effect.fail(commandNotFound(name));
    }
    return yield* announced({ command: rotated.command, secret });
  });
}

export { type AddNeeds, addCommand, rotateCommandSecret };
