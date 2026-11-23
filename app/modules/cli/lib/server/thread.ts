import { Command, Flag } from "effect/cli";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { Argument } from "effect/cli";
import type { CommandFailed } from "./output.ts";
import type { ListOpenThreadsQuery } from "../../../messages/client.ts";
import type { MessageId } from "../../../messages/index.ts";
import { Option } from "effect";
import { answer } from "./output.ts";

type ThreadCommand = Command.Command<"thread", object, object, CommandFailed, AgentSessionStateNeeds>;

const NOTHING = {};

interface ListFlags {
  readonly all: boolean;
  readonly cursor: Option.Option<string>;
  readonly limit: Option.Option<number>;
}

const allFlag = Flag.Boolean("all").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Every open thread on the board, not only the ones involving you."),
);
const cursorFlag = Flag.String("cursor").pipe(
  Flag.optional,
  Flag.withDescription("Only threads after this point: the previous page's cursor."),
);
const limitFlag = Flag.Int("limit").pipe(Flag.optional, Flag.withDescription("1-200 threads. Default 50."));

function openThreadsQuery({ all, cursor, limit }: ListFlags): ListOpenThreadsQuery {
  const withCursor = Option.match(cursor, { onNone: () => NOTHING, onSome: (value) => ({ cursor: value }) });
  const withLimit = Option.match(limit, { onNone: () => NOTHING, onSome: (value) => ({ limit: value }) });
  return { all, ...withCursor, ...withLimit };
}

const listCommand = Command.make("list", { all: allFlag, cursor: cursorFlag, limit: limitFlag }, (flags) =>
  answer((client) => client.listOpenThreads(openThreadsQuery(flags))),
).pipe(
  Command.withDescription(
    "List open threads, stalest first by last activity (latest message or reopen): the ones you started, replied " +
      "in or are mentioned in, or every one with --all. Pass the answer's cursor to --cursor for the next page.",
  ),
);

function threadCommandFor(messageIdArgument: Argument.Argument<MessageId>): ThreadCommand {
  const getCommand = Command.make("get", { id: messageIdArgument }, ({ id }) =>
    answer((client) => client.getThread(id)),
  ).pipe(Command.withDescription("Show the thread holding a message: its top-level message and every reply."));
  const closeCommand = Command.make("close", { id: messageIdArgument }, ({ id }) =>
    answer((client) => client.closeThread(id)),
  ).pipe(Command.withDescription("Close the thread holding a message once its work is done; a reply reopens it."));
  const reopenCommand = Command.make("reopen", { id: messageIdArgument }, ({ id }) =>
    answer((client) => client.reopenThread(id)),
  ).pipe(Command.withDescription("Reopen the thread holding a message and print its top-level message."));
  return Command.make("thread").pipe(
    Command.withDescription("Read, list, close and reopen threads."),
    Command.withSubcommands([getCommand, listCommand, closeCommand, reopenCommand]),
  );
}

export { threadCommandFor };
