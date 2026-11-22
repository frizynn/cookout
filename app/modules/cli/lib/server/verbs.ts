import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { CookoutClient } from "../../../sdk/index.ts";
import { callServer } from "./adapters/sdk.ts";
import { printAnswer, refused } from "./output.ts";

const answer = <A>(call: (client: CookoutClient) => Promise<A>) =>
  callServer(call).pipe(Effect.flatMap(printAnswer), Effect.catch(refused));

export const whoamiCommand = Command.make("whoami", {}, () => answer((client) => client.whoami())).pipe(
  Command.withDescription("Show the identity behind COOKOUT_TOKEN."),
);

const name = Argument.String("name").pipe(Argument.withDescription("The identity's name."));

const listCommand = Command.make("list", {}, () => answer((client) => client.listIdentities())).pipe(
  Command.withDescription("List every identity and its owner, sorted by name."),
);

const createCommand = Command.make(
  "create",
  {
    name,
    owner: Flag.String("owner").pipe(Flag.optional, Flag.withDescription("The person the identity belongs to.")),
  },
  ({ name: identity, owner }) =>
    answer((client) =>
      client.createIdentity(Option.isSome(owner) ? { name: identity, owner: owner.value } : { name: identity }),
    ),
).pipe(Command.withDescription("Create an identity (admin only). Its token is shown this once."));

const rotateCommand = Command.make("rotate", { name }, (input) =>
  answer((client) => client.rotateToken(input.name)),
).pipe(Command.withDescription("Issue a new token for an identity (admin only). The old one stops working at once."));

const deleteCommand = Command.make("delete", { name }, (input) =>
  answer((client) => client.deleteIdentity(input.name)),
).pipe(Command.withDescription("Delete an identity (admin only). Its token stops working."));

export const identityCommand = Command.make("identity").pipe(
  Command.withDescription("Create, list, rotate and delete identities."),
  Command.withSubcommands([createCommand, listCommand, rotateCommand, deleteCommand]),
);
