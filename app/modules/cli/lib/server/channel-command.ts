import { Argument, Command, Flag } from "effect/cli";
import { Effect, Option, Record } from "effect";
import { answer, answered } from "./output.ts";
import { callServer } from "./adapters/sdk.ts";

const NOTHING = {};

const channelRouteCommand = Command.make(
  "route",
  {
    fallback: Flag.String("fallback").pipe(
      Flag.optional,
      Flag.withDescription("The agent that hears it when the router fails, takes over 5 s or picks no one."),
    ),
    name: Argument.String("name").pipe(Argument.withDescription("The channel's name.")),
    owner: Flag.String("owner").pipe(
      Flag.optional,
      Flag.withDescription("The agent that hears every top-level message a person posts here without a mention."),
    ),
    router: Flag.String("router").pipe(
      Flag.optional,
      Flag.withDescription(
        "An http or https URL asked which agents should hear such a message, in place of an owner. Its secret is shown once.",
      ),
    ),
  },
  ({ fallback, name, owner, router }) =>
    answer((client) => client.setChannelRouting(name, Record.getSomes({ fallback, owner, router }))),
).pipe(
  Command.withDescription(
    "Set who hears a person's top-level message with no mention in a channel (admin only): --owner, or --router with an optional --fallback. Flags left out are cleared; none clears all.",
  ),
);

function boardLimitFlag(name: string, description: string): Flag.Flag<Option.Option<number>> {
  return Flag.Int(name).pipe(Flag.optional, Flag.withDescription(description));
}

const boardLimitsCommand = Command.make(
  "limits",
  {
    agentMentions: boardLimitFlag(
      "agent-mentions",
      "How many agents one message of an agent may mention, 1-100. Default 1.",
    ),
    agentTurns: boardLimitFlag(
      "agent-turns",
      "How many messages in a row two agents or more may post in a thread before a person writes there, 1-100. Default 6.",
    ),
  },
  ({ agentMentions, agentTurns }) => {
    if (Option.isNone(agentMentions) && Option.isNone(agentTurns)) {
      return answer((client) => client.boardLimits());
    }
    return answered(
      Effect.flatMap(
        callServer((client) => client.boardLimits()),
        ({ limits }) =>
          callServer((client) =>
            client.setBoardLimits({
              agentMentions: Option.getOrElse(agentMentions, () => limits.agentMentions),
              agentTurns: Option.getOrElse(agentTurns, () => limits.agentTurns),
            }),
          ),
      ),
    );
  },
).pipe(
  Command.withDescription(
    "Show the board's limits on agents talking to agents, or change them with the flags (admin only).",
  ),
);

const boardCommand = Command.make("board").pipe(
  Command.withDescription("The board's settings."),
  Command.withSubcommands([boardLimitsCommand]),
);

const channelCreateCommand = Command.make(
  "create",
  {
    description: Flag.String("description").pipe(
      Flag.optional,
      Flag.withDescription("What the channel is for, 1-500 characters."),
    ),
    name: Argument.String("name").pipe(Argument.withDescription("1-80 lowercase letters, digits or '-'.")),
  },
  ({ name, description }) => {
    const withDescription = Option.match(description, {
      onNone: () => NOTHING,
      onSome: (value) => ({ description: value }),
    });
    return answer((client) => client.createChannel({ name, ...withDescription }));
  },
).pipe(Command.withDescription("Create a channel. Any identity can, and is subscribed to it; unsubscribe to stop."));

const subscribedFlag = Flag.Boolean("subscribed").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Only the channels you subscribe to."),
);

const channelListCommand = Command.make("list", { subscribed: subscribedFlag }, ({ subscribed }) => {
  if (subscribed) {
    return answer((client) => client.listSubscribedChannels());
  }
  return answer((client) => client.listChannels());
}).pipe(Command.withDescription("List every channel, by name, or with --subscribed only yours."));

const channelGetCommand = Command.make("get", { name: Argument.String("name") }, ({ name }) =>
  answer((client) => client.getChannel(name)),
).pipe(Command.withDescription("Show one channel."));

const channelDeleteCommand = Command.make("delete", { name: Argument.String("name") }, ({ name }) =>
  answer((client) => client.deleteChannel(name)),
).pipe(
  Command.withDescription(
    "Delete a channel and everything in it (admin only). Its name can be created again, as a new, empty channel.",
  ),
);

const channelCommand = Command.make("channel").pipe(
  Command.withDescription("Create, list, get, route and delete channels."),
  Command.withSubcommands([
    channelCreateCommand,
    channelListCommand,
    channelGetCommand,
    channelRouteCommand,
    channelDeleteCommand,
  ]),
);

export { boardCommand, channelCommand };
