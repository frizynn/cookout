import { Argument, Command, Flag } from "effect/cli";
import { approveJoinCommand, denyJoinCommand, joinCommand, leaveCommand } from "./join-command.ts";
import { avatarCommand, identityCommand, keepCommand } from "./identity.ts";
import {
  beforeFlag,
  channelArgument,
  limitFlag,
  messageCommand,
  messageIdArgument,
  pageQuery,
  scheduleCommand,
} from "./message-command.ts";
import { boardCommand, channelCommand } from "./channel-command.ts";
import { searchCommand, threadCommandFor } from "./thread.ts";
import { answer } from "./output.ts";
import { assetCommand } from "./attachments.ts";
import { helpCommand } from "./help-monitor.ts";
import { webhookCommandVerb } from "./command.ts";

const threadCommand = threadCommandFor(messageIdArgument);

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

const reactionArgument = Argument.ChoiceWithValue("reaction", [
  ["up", "thumbs_up"],
  ["down", "thumbs_down"],
] as const).pipe(Argument.withDescription("up for thumbs up, down for thumbs down."));

const reactCommand = Command.make("react", { id: messageIdArgument, reaction: reactionArgument }, ({ id, reaction }) =>
  answer((client) => client.react(id, reaction)),
).pipe(
  Command.withDescription(
    "Leave a thumbs up or thumbs down on a message. Its author gets an inbox item saying so. Prints the message's reactions.",
  ),
);

const unreactCommand = Command.make(
  "unreact",
  { id: messageIdArgument, reaction: reactionArgument },
  ({ id, reaction }) => answer((client) => client.unreact(id, reaction)),
).pipe(
  Command.withDescription("Take back your thumbs up or thumbs down on a message. Prints the message's reactions."),
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
  boardCommand,
  messageCommand,
  assetCommand,
  avatarCommand,
  threadCommand,
  searchCommand,
  joinCommand,
  leaveCommand,
  approveJoinCommand,
  denyJoinCommand,
  inboxCommand,
  ackCommand,
  keepCommand,
  unreadCommand,
  reactCommand,
  unreactCommand,
  followCommand,
  unfollowCommand,
  subscribeCommand,
  unsubscribeCommand,
  scheduleCommand,
  webhookCommandVerb,
  helpCommand,
] as const;
