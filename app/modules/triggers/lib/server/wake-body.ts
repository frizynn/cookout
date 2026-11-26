import { Effect, Option } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { SessionWake, WakeReason } from "../../index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import type { Channel } from "../../../channels/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { TriggerWake } from "./caller.ts";
import { hrefOf } from "../../../paths/index.ts";

interface Woken {
  readonly storage: Storage["Service"];
  readonly message: Message;
  readonly agent: IdentityName;
}

function topLevelOf({ message, storage }: Woken): Effect.Effect<Option.Option<Message>, StorageUnavailable> {
  if (message.kind === "top-level") {
    return Effect.succeedSome(message);
  }
  return Effect.map(storage.getThread(message.replyTo), (thread) =>
    Option.map(Option.fromUndefinedOr(thread), ({ parent }) => parent),
  );
}

function fellBackTo(agent: IdentityName, { route }: Message): boolean {
  return Option.exists(Option.fromUndefinedOr(route), ({ by, to }) => by === "fallback" && to.includes(agent));
}

function wakeOn(channel: Channel | undefined): Option.Option<SessionWake> {
  return Option.map(
    Option.flatMap(Option.fromUndefinedOr(channel), ({ fallbackWake }) => Option.fromUndefinedOr(fallbackWake)),
    (wake) => ({ mode: "ephemeral" as const, ...wake }),
  );
}

function fallbackWakeOf(woken: Woken): Effect.Effect<Option.Option<SessionWake>, StorageUnavailable> {
  return Effect.gen(function* findFallbackWake() {
    const parent = yield* topLevelOf(woken);
    const top = Option.filter(parent, (found) => fellBackTo(woken.agent, found));
    if (Option.isNone(top)) {
      return Option.none();
    }
    const channel = yield* woken.storage.findChannel(top.value.channel);
    return wakeOn(channel);
  });
}

interface Woke extends Woken {
  readonly boardUrl: string;
  readonly reason: WakeReason;
}

interface WakeBody {
  readonly text: string;
  readonly wake: TriggerWake;
}

function threadOf(message: Message): MessageId {
  if (message.kind === "reply") {
    return message.replyTo;
  }
  return message.id;
}

function textFor(boardUrl: string, message: Message): string {
  const href = hrefOf({ channel: message.channel, message: message.id, name: "thread", thread: threadOf(message) });
  return `${boardUrl}/${href}\n\n${message.text}`;
}

function wakeBodyOf(woke: Woke): Effect.Effect<WakeBody, StorageUnavailable> {
  const { boardUrl, message, reason } = woke;
  return Effect.map(fallbackWakeOf(woke), (session) => ({
    text: textFor(boardUrl, message),
    wake: {
      author: message.author.name,
      channel: message.channel,
      message: message.id,
      reason,
      thread: threadOf(message),
      ...Option.match(session, { onNone: () => ({}), onSome: (found) => ({ wake: found }) }),
    },
  }));
}

export { wakeBodyOf };
