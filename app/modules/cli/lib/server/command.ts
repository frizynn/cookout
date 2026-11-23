import { Argument, Command, Flag } from "effect/cli";
import { Effect, Option, Schema } from "effect";
import { printAnswer, refused } from "./output.ts";
import type { Call } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import { callServer } from "./adapters/sdk.ts";

const NOTHING = {};

const JsonSchemaFile = Schema.Record(Schema.String, Schema.Json);

const JsonText = Schema.fromJsonString(Schema.Json);

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

const commandCallCommand = Command.make(
  "call",
  {
    channel: Flag.String("channel").pipe(Flag.withDescription("The channel the call message is posted in.")),
    data: Flag.String("data").pipe(
      Flag.withSchema(JsonText),
      Flag.withDescription("The call's data, as JSON. It must follow the command's schema."),
    ),
    name: Argument.String("name").pipe(Argument.withDescription("The command to call.")),
  },
  ({ channel, data, name }) => answer((client) => client.callCommand(name, { channel, data })),
).pipe(
  Command.withDescription(
    "Call a command. Data that breaks its schema is refused with the schema errors and nothing is posted. " +
      "Otherwise the call is posted in the channel as your message, you follow its thread, and the answer is " +
      "{ messageId, threadId } without waiting for the handler.",
  ),
);

export const commandCommand = Command.make("command").pipe(
  Command.withDescription("Register, list and call webhook commands."),
  Command.withSubcommands([commandAddCommand, commandListCommand, commandCallCommand]),
);
