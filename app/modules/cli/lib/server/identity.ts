import { Argument, Command, Flag } from "effect/cli";
import { Effect, Option } from "effect";
import { answer, answered } from "./output.ts";
import type { CallFailure } from "./adapters/sdk.ts";
import { callServer } from "./adapters/sdk.ts";
import { identityKinds } from "../../../identities/index.ts";

const NOTHING = {};

const identityName = Argument.String("name").pipe(Argument.withDescription("The identity's name."));

const identityCreateCommand = Command.make(
  "create",
  {
    displayName: Flag.String("display-name").pipe(
      Flag.optional,
      Flag.withDescription("The name shown beside @name, such as 'Ada Lovelace': 1-80 characters after trimming."),
    ),
    kind: Flag.Literals("kind", identityKinds).pipe(
      Flag.withDescription("human for a person, agent for a program. It never changes."),
    ),
    name: identityName,
    owner: Flag.String("owner").pipe(
      Flag.optional,
      Flag.withDescription("The person the agent belongs to. A human has no owner."),
    ),
  },
  ({ displayName, kind, name, owner }) => {
    const withOwner = Option.match(owner, { onNone: () => NOTHING, onSome: (value) => ({ owner: value }) });
    const named = Option.match(displayName, { onNone: () => NOTHING, onSome: (value) => ({ displayName: value }) });
    return answer((client) => client.createIdentity({ kind, name, ...withOwner, ...named }));
  },
).pipe(Command.withDescription("Create an identity (admin only). Its token is shown this once."));

const identityListCommand = Command.make("list", {}, () => answer((client) => client.listIdentities())).pipe(
  Command.withDescription("List every identity with its kind and owner, sorted by name."),
);

const identityRotateCommand = Command.make("rotate", { name: identityName }, ({ name }) =>
  answer((client) => client.rotateToken(name)),
).pipe(Command.withDescription("Issue a new token for an identity (admin only). The old one stops working at once."));

const identityDeleteCommand = Command.make("delete", { name: identityName }, ({ name }) =>
  answer((client) => client.deleteIdentity(name)),
).pipe(Command.withDescription("Delete an identity (admin only). Its token stops working."));

const identityAdminCommand = Command.make(
  "admin",
  {
    name: identityName,
    remove: Flag.Boolean("remove").pipe(Flag.withDefault(false), Flag.withDescription("Remove admin instead.")),
  },
  ({ name, remove }) => {
    if (remove) {
      return answer((client) => client.removeAdmin(name));
    }
    return answer((client) => client.makeAdmin(name));
  },
).pipe(Command.withDescription("Make a human an admin, or remove admin with --remove (admin only)."));

const textOrClear: CallFailure = { code: "usage", message: "Give either the display name or --clear, not both." };

function displayNameToSend(text: Option.Option<string>, clear: boolean): Effect.Effect<string | null, CallFailure> {
  if (!clear) {
    return Effect.mapError(Effect.fromOption(text), () => textOrClear);
  }
  return Option.match(text, { onNone: () => Effect.succeed(null), onSome: () => Effect.fail(textOrClear) });
}

const identityDisplayNameCommand = Command.make(
  "display-name",
  {
    clear: Flag.Boolean("clear").pipe(Flag.withDefault(false), Flag.withDescription("Remove the display name.")),
    name: identityName,
    text: Argument.String("display-name").pipe(
      Argument.optional,
      Argument.withDescription("The display name: 1-80 characters after trimming, such as 'Ada Lovelace'."),
    ),
  },
  ({ clear, name, text }) =>
    answered(
      Effect.flatMap(displayNameToSend(text, clear), (displayName) =>
        callServer((client) => client.setDisplayName(name, displayName)),
      ),
    ),
).pipe(Command.withDescription("Set or clear a display name: your own, your agent's, or (admin) anyone's."));

const identityCommand = Command.make("identity").pipe(
  Command.withDescription("Create, list, rotate and delete identities, make or remove admins, and set display names."),
  Command.withSubcommands([
    identityCreateCommand,
    identityListCommand,
    identityRotateCommand,
    identityDeleteCommand,
    identityAdminCommand,
    identityDisplayNameCommand,
  ]),
);

export { identityCommand };
