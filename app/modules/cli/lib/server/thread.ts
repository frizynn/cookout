import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { Argument } from "effect/cli";
import { Command } from "effect/cli";
import type { CommandFailed } from "./output.ts";
import type { MessageId } from "../../../messages/index.ts";
import { answer } from "./output.ts";

type ThreadCommand = Command.Command<"thread", object, object, CommandFailed, AgentSessionStateNeeds>;

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
    Command.withDescription("Read, close and reopen threads."),
    Command.withSubcommands([getCommand, closeCommand, reopenCommand]),
  );
}

export { threadCommandFor };
