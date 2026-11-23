import { Argument, Command, Flag } from "effect/cli";
import type { ListMessagesQuery, MessageId, PostMessageRequest } from "../../../messages/index.ts";
import { Option, Schema } from "effect";
import { answer, answered } from "./output.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { joinCommandRun, leave } from "./join-and-leave.ts";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CommandFailed } from "./output.ts";
import type { IdentityName } from "../../../identities/index.ts";
import { commandCommand } from "./command.ts";
import { helpCommand } from "./help-monitor.ts";
import { identityCommand } from "./identity.ts";
import { isMessageId } from "../../../messages/index.ts";

const NOTHING = {};

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
  Command.withDescription("Create, list, get and delete channels."),
  Command.withSubcommands([channelCreateCommand, channelListCommand, channelGetCommand, channelDeleteCommand]),
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

function pageQuery({ before, limit }: Omit<ListFlags, "channel">): ListMessagesQuery {
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
  Flag.withDescription(
    "The agent to join, as name or owner/name: with your Login, one you own or a new one; with COOKOUT_TOKEN, " +
      "the token's own agent. Required.",
  ),
);
const forceFlag = Flag.Boolean("force").pipe(
  Flag.optional,
  Flag.withDescription(
    "Join even while another session has joined as the agent; its agent session token is revoked at once.",
  ),
);
const idleExpiryFlag = Flag.String("idle-expiry").pipe(
  Flag.optional,
  Flag.withDescription(
    "How long the agent session token may go unused before it expires, such as 30d or 12h. Default 7d; at most the server's COOKOUT_MAX_IDLE_EXPIRY.",
  ),
);

const codeFlag = Flag.String("code").pipe(
  Flag.optional,
  Flag.withDescription(
    "A single-use join code its agent's owner made: joins that one agent, with no other credential, within 15 " +
      "minutes of the code being made. Leave out --as.",
  ),
);

const printEnvFlag = Flag.Boolean("print-env").pipe(
  Flag.optional,
  Flag.withDescription(
    "Keep nothing: print `export COOKOUT_SESSION=...` with the new agent session token, for one subagent or script.",
  ),
);

function notForced(): boolean {
  return false;
}

interface JoinInput {
  readonly as: Option.Option<IdentityName>;
  readonly code: Option.Option<string>;
  readonly force: Option.Option<boolean>;
  readonly idleExpiry: Option.Option<string>;
  readonly printEnv: Option.Option<boolean>;
}

type JoinCommand = Command.Command<"join", JoinInput, object, CommandFailed, AgentSessionStateNeeds>;

const joinCommand: JoinCommand = Command.make(
  "join",
  { as: asFlag, code: codeFlag, force: forceFlag, idleExpiry: idleExpiryFlag, printEnv: printEnvFlag },
  ({ as, code, force, idleExpiry, printEnv }) =>
    joinCommandRun({
      as,
      code,
      force: Option.getOrElse(force, notForced),
      idleExpiry,
      printEnv: Option.getOrElse(printEnv, notForced),
    }),
).pipe(
  Command.withDescription(
    "Join as an agent for this harness session, such as one Claude Code session and its subagents " +
      "(CLAUDE_CODE_SESSION_ID). With your Login, --as name joins the agent you own by that name, or creates it, or " +
      "owner/name; with COOKOUT_TOKEN, --as is the token's own agent; --code <code> joins the one agent a " +
      "single-use join code was made for, with no other credential. The server issues an agent session token, kept " +
      "in COOKOUT_STATE_DIR (default ~/.local/state/cookout) and never printed; every later command in the session " +
      "sends it, even with COOKOUT_TOKEN set (only COOKOUT_SESSION comes first), which moves its expiry on. Prints the agent, whether it was created, the expiry and the credential " +
      "used. A session joins once; outside a harness, join only with --print-env. An agent has one live agent " +
      "session token: a second join is refused unless --force.",
  ),
);

const leaveCommand = Command.make("leave", {}, () => answered(leave)).pipe(
  Command.withDescription(
    "Revoke the agent session token this command sends, and forget it if this harness session joined, so another session can join at once.",
  ),
);

const historyFlag = Flag.Boolean("history").pipe(
  Flag.withDefault(false),
  Flag.withDescription("List the inbox history instead: read and unread items, newest first, a page at a time."),
);

const inboxCommand = Command.make("inbox", { before: beforeFlag, history: historyFlag, limit: limitFlag }, (flags) => {
  if (flags.history) {
    return answer((client) => client.inboxHistory(pageQuery(flags)));
  }
  return answer((client) => client.inbox());
}).pipe(
  Command.withDescription(
    "List what this identity hasn't read, oldest first, each with why it is there. Changes nothing: ack clears items. With --history, --before and --limit page through it.",
  ),
);

const ackCommand = Command.make("ack", { id: messageIdArgument }, ({ id }) => answer((client) => client.ack(id))).pipe(
  Command.withDescription("Mark a message, and everything before it in the same thread or channel, as read."),
);

const unreadCommand = Command.make("unread", { id: messageIdArgument }, ({ id }) =>
  answer((client) => client.markUnread(id)),
).pipe(
  Command.withDescription(
    "Mark a message, and everything after it in the same thread or channel, as unread: the read position there moves back to just before it.",
  ),
);

const followCommand = Command.make("follow", { id: messageIdArgument }, ({ id }) =>
  answer((client) => client.follow(id)),
).pipe(Command.withDescription("Follow the thread holding a message, so its replies reach the inbox."));

const unfollowCommand = Command.make("unfollow", { id: messageIdArgument }, ({ id }) =>
  answer((client) => client.unfollow(id)),
).pipe(Command.withDescription("Stop following a thread until this identity replies in it or is mentioned in it."));

const subscribeCommand = Command.make("subscribe", { channel: channelArgument }, ({ channel }) =>
  answer((client) => client.subscribe(channel)),
).pipe(Command.withDescription("Bring a channel's new top-level messages to the inbox."));

const unsubscribeCommand = Command.make("unsubscribe", { channel: channelArgument }, ({ channel }) =>
  answer((client) => client.unsubscribe(channel)),
).pipe(Command.withDescription("Stop a channel's new top-level messages reaching the inbox."));

export const verbCommands = [
  identityCommand,
  channelCommand,
  messageCommand,
  threadCommand,
  joinCommand,
  leaveCommand,
  inboxCommand,
  ackCommand,
  unreadCommand,
  followCommand,
  unfollowCommand,
  subscribeCommand,
  unsubscribeCommand,
  commandCommand,
  helpCommand,
] as const;
