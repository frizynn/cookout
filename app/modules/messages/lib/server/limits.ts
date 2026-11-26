import type { AgentIdentity, Identity, IdentityName } from "../../../identities/index.ts";
import { Array as Arr, Effect, Option, Predicate } from "effect";
import type { Message, MessageId } from "../../index.ts";
import type { NewMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import type { BoardLimits } from "../../../channels/index.ts";
import type { Refusal } from "../../../http/index.ts";

interface Posted {
  readonly author: Identity;
  readonly message: NewMessage;
}

interface Checked extends Posted {
  readonly storage: Storage["Service"];
}

const UNPROCESSABLE = 422;

const TALKING = 2;

function isActiveAgent(identity: Identity | undefined): identity is AgentIdentity {
  return Predicate.isNotUndefined(identity) && identity.kind === "agent" && identity.deactivated !== true;
}

function mentionLimitReached(limits: BoardLimits, owner: string): Refusal {
  return {
    code: "agent_mention_limit",
    message: `An agent may mention at most ${String(limits.agentMentions)} agent(s) in one message on this board. Mention your owner @${owner} to ask for more.`,
    status: UNPROCESSABLE,
  };
}

function turnLimitReached(limits: BoardLimits, owner: string): Refusal {
  return {
    code: "agent_turn_limit",
    message: `Agents have posted ${String(limits.agentTurns)} messages in a row in this thread, the most this board allows before a person writes. Mention your owner @${owner} in your reply to hand it back.`,
    status: UNPROCESSABLE,
  };
}

function isAgentAuthored(message: Message): boolean {
  return Predicate.isNotUndefined(message.author.owner);
}

function agentRunAtEnd(messages: readonly Message[]): readonly Message[] {
  return Arr.takeWhile(Arr.reverse(messages), isAgentAuthored);
}

function agentsTalking(thread: readonly Message[], author: AgentIdentity, turns: number): boolean {
  const run = agentRunAtEnd(thread);
  const speakers = new Set([author.name, ...Arr.map(run, (each) => each.author.name)]);
  return run.length >= turns && speakers.size >= TALKING;
}

function threadMessages(
  storage: Storage["Service"],
  replyTo: MessageId | undefined,
): Effect.Effect<readonly Message[], StorageUnavailable> {
  return Option.match(Option.fromUndefinedOr(replyTo), {
    onNone: () => Effect.succeed([]),
    onSome: (parent) =>
      Effect.map(storage.getThread(parent), (thread) =>
        Option.match(Option.fromUndefinedOr(thread), {
          onNone: () => [],
          onSome: ({ parent: first, replies }) => [first, ...replies],
        }),
      ),
  });
}

function mentionedAgents(
  storage: Storage["Service"],
  { author, message }: Posted,
): Effect.Effect<readonly IdentityName[], StorageUnavailable> {
  return Effect.filter(
    Arr.filter(message.mentions, (name) => name !== author.name),
    (name) => Effect.map(storage.findIdentityByName(name), isActiveAgent),
  );
}

function limitRefusal(
  storage: Storage["Service"],
  author: AgentIdentity,
  message: NewMessage,
): Effect.Effect<Option.Option<Refusal>, StorageUnavailable> {
  return Effect.gen(function* checkLimits() {
    const limits = yield* storage.getBoardLimits();
    const agents = yield* mentionedAgents(storage, { author, message });
    if (agents.length > limits.agentMentions) {
      return Option.some(mentionLimitReached(limits, author.owner));
    }
    const thread = yield* threadMessages(storage, message.replyTo);
    const handedBack = message.mentions.includes(author.owner) && Arr.isReadonlyArrayEmpty(agents);
    if (!handedBack && agentsTalking(thread, author, limits.agentTurns)) {
      return Option.some(turnLimitReached(limits, author.owner));
    }
    return Option.none();
  });
}

function checkAgentLimits({ author, message, storage }: Checked): Effect.Effect<void, Refusal | StorageUnavailable> {
  if (author.kind !== "agent") {
    return Effect.void;
  }
  return Effect.flatMap(
    limitRefusal(storage, author, message),
    Option.match({ onNone: () => Effect.void, onSome: Effect.fail }),
  );
}

export { type Posted, checkAgentLimits, isActiveAgent };
