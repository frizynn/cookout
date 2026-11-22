import { Argument, Command, Flag } from "effect/cli";
import { Effect, Option, Schema } from "effect";
import type { ListMessagesQuery, MessageId, PostMessageRequest } from "../../../messages/index.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { join, leave } from "./join-and-leave.ts";
import { printAnswer, refused } from "./output.ts";
import type { CallFailure } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { CookoutClient } from "../../../sdk/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import { callServer } from "./adapters/sdk.ts";
import { isMessageId } from "../../../messages/index.ts";

function answered<Value>(
  effect: Effect.Effect<Value, CallFailure, LeaseStateNeeds>,
): Effect.Effect<void, CommandFailed, LeaseStateNeeds> {
  return effect.pipe(Effect.flatMap(printAnswer), Effect.catch(refused));
}

const answer = <A>(call: (client: CookoutClient) => Promise<A>) => answered(callServer(call));

const whoamiCommand = Command.make("whoami", {}, () => answer((client) => client.whoami())).pipe(
  Command.withDescription("Show the identity behind COOKOUT_TOKEN."),
);

const NOTHING = {};

const identityName = Argument.String("name").pipe(Argument.withDescription("The identity's name."));

const identityCreateCommand = Command.make(
  "create",
  {
    name: identityName,
    owner: Flag.String("owner").pipe(Flag.optional, Flag.withDescription("The person the identity belongs to.")),
  },
  ({ name, owner }) => {
    const withOwner = Option.match(owner, { onNone: () => NOTHING, onSome: (value) => ({ owner: value }) });
    return answer((client) => client.createIdentity({ name, ...withOwner }));
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

const identityCommand = Command.make("identity").pipe(
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
    const withDescription = Option.match(description, {
      onNone: () => NOTHING,
      onSome: (value) => ({ description: value }),
    });
    return answer((client) => client.createChannel({ name, ...withDescription }));
  },
).pipe(Command.withDescription("Create a channel. Any identity can."));

const channelListCommand = Command.make("list", {}, () => answer((client) => client.listChannels())).pipe(
  Command.withDescription("List every channel, by name."),
);

const channelGetCommand = Command.make("get", { name: Argument.String("name") }, ({ name }) =>
  answer((client) => client.getChannel(name)),
).pipe(Command.withDescription("Show one channel."));

const channelCommand = Command.make("channel").pipe(
  Command.withDescription("Create, list and get channels."),
  Command.withSubcommands([channelCreateCommand, channelListCommand, channelGetCommand]),
);

interface PostFlags {
  readonly channel: string;
  readonly data: Option.Option<Schema.Json>;
  readonly replyTo: Option.Option<number>;
  readonly text: string;
}

interface ListFlags {
  readonly before: Option.Option<number>;
  readonly channel: string;
  readonly limit: Option.Option<number>;
}

function postRequest({ channel, data, replyTo, text }: PostFlags): PostMessageRequest {
  const withData = Option.match(data, { onNone: () => NOTHING, onSome: (value) => ({ data: value }) });
  const withReplyTo = Option.match(replyTo, { onNone: () => NOTHING, onSome: (value) => ({ replyTo: value }) });
  return { channel, text, ...withData, ...withReplyTo };
}

function pageQuery({ before, limit }: ListFlags): ListMessagesQuery {
  const withBefore = Option.match(before, { onNone: () => NOTHING, onSome: (value) => ({ before: value }) });
  const withLimit = Option.match(limit, { onNone: () => NOTHING, onSome: (value) => ({ limit: value }) });
  return { ...withBefore, ...withLimit };
}

function messageIdOf(value: number): Option.Option<MessageId> {
  return Option.liftPredicate(value, isMessageId);
}

function notAMessageId(value: number): string {
  return `${String(value)} is not a message ID.`;
}

const channelArgument = Argument.String("channel").pipe(Argument.withDescription("The channel's name."));
const textArgument = Argument.String("text").pipe(Argument.withDescription("The message, 1-40,000 characters."));
const jsonData = Flag.String("data").pipe(Flag.withSchema(Schema.fromJsonString(Schema.Json)));
const dataFlag = jsonData.pipe(Flag.optional, Flag.withDescription("Any JSON value, for commands and agents to read."));
const replyToFlag = Flag.Int("reply-to").pipe(
  Flag.optional,
  Flag.withDescription("Reply in this message's thread. A reply to a reply joins the same thread."),
);
const beforeFlag = Flag.Int("before").pipe(
  Flag.optional,
  Flag.withDescription("Only messages before this message ID."),
);
const limitFlag = Flag.Int("limit").pipe(Flag.optional, Flag.withDescription("1-200 messages. Default 50."));
const messageIdArgument = Argument.Int("message-id").pipe(Argument.filterMap(messageIdOf, notAMessageId));

const messagePostCommand = Command.make(
  "post",
  { channel: channelArgument, data: dataFlag, replyTo: replyToFlag, text: textArgument },
  (flags) => answer((client) => client.createMessage(postRequest(flags))),
).pipe(Command.withDescription("Post a message, or a reply with --reply-to."));

const messageListCommand = Command.make(
  "list",
  { before: beforeFlag, channel: channelArgument, limit: limitFlag },
  (flags) => answer((client) => client.listMessages(flags.channel, pageQuery(flags))),
).pipe(Command.withDescription("List a channel's top-level messages, oldest first: the newest page, or --before."));

const messageCommand = Command.make("message").pipe(
  Command.withDescription("Post messages and page through a channel's messages."),
  Command.withSubcommands([messagePostCommand, messageListCommand]),
);

const threadGetCommand = Command.make("get", { id: messageIdArgument }, ({ id }) =>
  answer((client) => client.getThread(id)),
).pipe(Command.withDescription("Show the thread holding a message: its top-level message and every reply."));

const threadCommand = Command.make("thread").pipe(
  Command.withDescription("Read threads."),
  Command.withSubcommands([threadGetCommand]),
);

const identityNameFlag = Schema.String.check(Schema.isPattern(identityNamePattern).abort()).pipe(
  Schema.refine(isIdentityName),
);
const asFlag = Flag.String("as").pipe(
  Flag.withSchema(identityNameFlag),
  Flag.optional,
  Flag.withDescription("The token's own identity: a check, not a switch. Required."),
);
const forceFlag = Flag.Boolean("force").pipe(
  Flag.optional,
  Flag.withDescription("Take the lease even if another session holds it; that session loses it at once."),
);

function notForced(): boolean {
  return false;
}

interface JoinInput {
  readonly as: Option.Option<IdentityName>;
  readonly force: Option.Option<boolean>;
}

type JoinCommand = Command.Command<"join", JoinInput, object, CommandFailed, LeaseStateNeeds>;

const joinCommand: JoinCommand = Command.make("join", { as: asFlag, force: forceFlag }, ({ as, force }) =>
  answered(join({ as, force: Option.getOrElse(force, notForced) })),
).pipe(
  Command.withDescription(
    "Take the lease on the token's identity. The lease ID is kept in COOKOUT_STATE_DIR (default " +
      "~/.local/state/cookout), and every later command sends it, which keeps the lease alive. Two sessions on one " +
      "machine with the same token share a lease unless their COOKOUT_STATE_DIR differs.",
  ),
);

const leaveCommand = Command.make("leave", {}, () => answered(leave)).pipe(
  Command.withDescription("Release the lease this session took with join, so another session can join at once."),
);

export const verbCommands = [
  whoamiCommand,
  identityCommand,
  channelCommand,
  messageCommand,
  threadCommand,
  joinCommand,
  leaveCommand,
] as const;
