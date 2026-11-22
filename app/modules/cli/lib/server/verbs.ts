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

const identityName = Argument.String("name").pipe(Argument.withDescription("The identity's name."));

const identityCreateCommand = Command.make(
  "create",
  {
    name: identityName,
    owner: Flag.String("owner").pipe(Flag.optional, Flag.withDescription("The person the identity belongs to.")),
  },
  ({ name, owner }) => {
    const request = Option.isSome(owner) ? { name, owner: owner.value } : { name };
    return answer((client) => client.createIdentity(request));
  },
).pipe(Command.withDescription("Create an identity (admin only). Its token is shown this once."));

const identityListCommand = Command.make("list", {}, () => answer((client) => client.listIdentities())).pipe(
  Command.withDescription("List every identity and its owner, sorted by name."),
);

const identityRotateCommand = Command.make("rotate", { name: identityName }, ({ name }) =>
  answer((client) => client.rotateToken(name)),
).pipe(Command.withDescription("Issue a new token for an identity (admin only). The old one stops working at once."));

const identityDeleteCommand = Command.make("delete", { name: identityName }, ({ name }) =>
  answer((client) => client.deleteIdentity(name)),
).pipe(Command.withDescription("Delete an identity (admin only). Its token stops working."));

export const identityCommand = Command.make("identity").pipe(
  Command.withDescription("Create, list, rotate and delete identities."),
  Command.withSubcommands([identityCreateCommand, identityListCommand, identityRotateCommand, identityDeleteCommand]),
);

const channelCreateCommand = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(Argument.withDescription("1-80 lowercase letters, digits or '-'.")),
    description: Flag.String("description").pipe(
      Flag.optional,
      Flag.withDescription("What the channel is for, 1-500 characters."),
    ),
  },
  ({ name, description }) => {
    const request = Option.isSome(description) ? { name, description: description.value } : { name };
    return answer((client) => client.createChannel(request));
  },
).pipe(Command.withDescription("Create a channel. Any identity can."));

const channelListCommand = Command.make("list", {}, () => answer((client) => client.listChannels())).pipe(
  Command.withDescription("List every channel, by name."),
);

const channelGetCommand = Command.make("get", { name: Argument.String("name") }, ({ name }) =>
  answer((client) => client.getChannel(name)),
).pipe(Command.withDescription("Show one channel."));

export const channelCommand = Command.make("channel").pipe(
  Command.withDescription("Create, list and get channels."),
  Command.withSubcommands([channelCreateCommand, channelListCommand, channelGetCommand]),
);
