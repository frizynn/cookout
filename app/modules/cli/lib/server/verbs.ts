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
