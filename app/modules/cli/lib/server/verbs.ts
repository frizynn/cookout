import { Effect, Option, Predicate, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { ListMessagesQuery, MessageId, PostMessageRequest } from "../../../messages/index.ts";
import type { CookoutClient } from "../../../sdk/index.ts";
import { callServer } from "./adapters/sdk.ts";
import { isMessageId } from "../../../messages/index.ts";
import { printAnswer, refused } from "./output.ts";

const answer = <A>(call: (client: CookoutClient) => Promise<A>) =>
  callServer(call).pipe(Effect.flatMap(printAnswer), Effect.catch(refused));

const whoamiCommand = Command.make("whoami", {}, () => answer((client) => client.whoami())).pipe(
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

const channelCommand = Command.make("channel").pipe(
  Command.withDescription("Create, list and get channels."),
  Command.withSubcommands([channelCreateCommand, channelListCommand, channelGetCommand]),
);

interface PostFlags {
  readonly channel: string;
  readonly data: Schema.Json | undefined;
  readonly replyTo: number | undefined;
  readonly text: string;
}

interface ListFlags {
  readonly before: number | undefined;
  readonly channel: string;
  readonly limit: number | undefined;
}

function dataPart(data: Schema.Json | undefined): Pick<PostMessageRequest, "data"> {
  if (Predicate.isUndefined(data)) {
    return {};
  }
  return { data };
}

function replyToPart(replyTo: number | undefined): Pick<PostMessageRequest, "replyTo"> {
  if (Predicate.isUndefined(replyTo)) {
    return {};
  }
  return { replyTo };
}

function beforePart(before: number | undefined): Pick<ListMessagesQuery, "before"> {
  if (Predicate.isUndefined(before)) {
    return {};
  }
  return { before };
}

function limitPart(limit: number | undefined): Pick<ListMessagesQuery, "limit"> {
  if (Predicate.isUndefined(limit)) {
    return {};
  }
  return { limit };
}

function postRequest({ channel, data, replyTo, text }: PostFlags): PostMessageRequest {
  return { channel, text, ...dataPart(data), ...replyToPart(replyTo) };
}

function pageQuery({ before, limit }: ListFlags): ListMessagesQuery {
  return { ...beforePart(before), ...limitPart(limit) };
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
const dataFlag = jsonData.pipe(
  Flag.withDefault(Effect.undefined),
  Flag.withDescription("Any JSON value, for commands and agents to read."),
);
const replyToFlag = Flag.Int("reply-to").pipe(
  Flag.withDefault(Effect.undefined),
  Flag.withDescription("Reply in this message's thread. A reply to a reply joins the same thread."),
);
const beforeFlag = Flag.Int("before").pipe(
  Flag.withDefault(Effect.undefined),
  Flag.withDescription("Only messages before this message ID."),
);
const limitFlag = Flag.Int("limit").pipe(
  Flag.withDefault(Effect.undefined),
  Flag.withDescription("1-200 messages. Default 50."),
);
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

export const verbCommands = [whoamiCommand, identityCommand, channelCommand, messageCommand, threadCommand] as const;
