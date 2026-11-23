import { Argument, Command, Flag } from "effect/cli";
import { Effect, Option, Schema } from "effect";
import { printAnswer, refused } from "./output.ts";
import type { Call } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import { callServer } from "./adapters/sdk.ts";

const NOTHING = {};

const JsonSchemaFile = Schema.Record(Schema.String, Schema.Json);

function answer<Value>(call: Call<Value>): Effect.Effect<void, CommandFailed, LeaseStateNeeds> {
  return Effect.matchEffect(callServer(call), { onFailure: refused, onSuccess: printAnswer });
}

const commandAddCommand = Command.make(
  "add",
  {
    description: Flag.String("description").pipe(
      Flag.optional,
      Flag.withDescription("What the command does, 1-500 characters."),
    ),
    name: Argument.String("name").pipe(
      Argument.withDescription("1-64 lowercase letters, digits or '-'. Also the name of its handler identity."),
    ),
    schema: Flag.FileSchema("schema", JsonSchemaFile, { format: "json" }).pipe(
      Flag.withDescription("A JSON file holding the JSON Schema (an object) every call's data must follow."),
    ),
    url: Flag.String("url").pipe(Flag.withDescription("The http or https URL the server posts calls to.")),
  },
  ({ description, name, schema, url }) => {
    const withDescription = Option.match(description, {
      onNone: () => NOTHING,
      onSome: (value) => ({ description: value }),
    });
    return answer((client) => client.addCommand({ name, schema, url, ...withDescription }));
  },
).pipe(
  Command.withDescription(
    "Register a webhook command (admin only). Its handler is an agent identity with the command's name, made " +
      "unless an agent of that name exists. The secret deliveries are signed with is shown this once.",
  ),
);

const commandListCommand = Command.make("list", {}, () => answer((client) => client.listCommands())).pipe(
  Command.withDescription("List every command, by name, without its secret."),
);

export const commandCommand = Command.make("command").pipe(
  Command.withDescription("Register and list webhook commands."),
  Command.withSubcommands([commandAddCommand, commandListCommand]),
);
