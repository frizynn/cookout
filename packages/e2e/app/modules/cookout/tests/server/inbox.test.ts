import type { BinNeeds, BinResult, CookoutUnderTestService } from "../../server.ts";
import { CookoutUnderTest, cookoutUnderTest, freshStateFolder, postedMessageId } from "../../server.ts";
import type { InboxReason, MessageId } from "@ai-hero/cookout/sdk";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { FileSystem } from "effect";
import { NodeServices } from "@effect/platform-node";

type Needs = BinNeeds | FileSystem.FileSystem;
type RunCookout = (...args: readonly string[]) => Effect.Effect<BinResult, never, Needs>;

interface Session {
  readonly name: string;
  readonly token: string;
  readonly cookout: RunCookout;
}

interface ExpectedInboxItem {
  readonly message: { readonly id: MessageId };
  readonly reasons: readonly InboxReason[];
}

const succeeded = { exitCode: 0, stderr: "" };
const ONE_AT_A_TIME = { concurrency: 1 } as const;

function freshProcessOf(cookout: CookoutUnderTestService, token: string): RunCookout {
  return (...args) =>
    Effect.flatMap(freshStateFolder, (stateFolder) => cookout.runCookout({ args, stateFolder, token }));
}

function joinedAgent(cookout: CookoutUnderTestService, name: string): Effect.Effect<Session, never, Needs> {
  return Effect.gen(function* joinAsAgent() {
    const { identity, token } = yield* cookout.createAgent(name);
    const stateFolder = yield* freshStateFolder;
    function run(...args: readonly string[]): Effect.Effect<BinResult, never, Needs> {
      return cookout.runCookout({ args, stateFolder, token });
    }
    const joined = yield* run("join", "--as", identity.name);

    expect(joined).toMatchObject(succeeded);

    return { cookout: run, name: identity.name, token };
  });
}

function post(session: Session, args: readonly string[]): Effect.Effect<MessageId, never, Needs> {
  return Effect.gen(function* postMessage() {
    const posted = yield* session.cookout("message", "post", ...args);

    expect(posted).toMatchObject(succeeded);

    return yield* postedMessageId(posted);
  });
}

function inboxOf(session: Session): Effect.Effect<unknown, never, Needs> {
  return Effect.map(session.cookout("inbox"), ({ stdoutJson }) => stdoutJson);
}

function inboxItem(message: MessageId, reasons: readonly InboxReason[]): ExpectedInboxItem {
  return { message: { id: message }, reasons };
}

const twoAgents = Effect.gen(function* twoAgentsInAChannel() {
  const cookout = yield* CookoutUnderTest;
  const { channel } = yield* cookout.createChannel("room");
  const first = yield* joinedAgent(cookout, "agent-1");
  const second = yield* joinedAgent(cookout, "agent-2");
  return { channel: channel.name, cookout, first, second };
});

it.live("two agents, each in its own cookout processes, post, reply and mention each other", () =>
  Effect.gen(function* talk() {
    const { channel, first, second } = yield* twoAgents;
    const top = yield* post(first, [channel, `Can you look at this, @${second.name}?`]);
    const reply = yield* post(second, [channel, `On it, @${first.name}.`, "--reply-to", String(top)]);
    const thanks = yield* post(first, [channel, "Thanks.", "--reply-to", String(reply)]);
    const thread = yield* second.cookout("thread", "get", String(top));

    expect(thread).toMatchObject(succeeded);
    expect(thread.stdoutJson).toMatchObject({
      parent: { author: { name: first.name }, id: top, kind: "top-level", mentions: [second.name], replyCount: 2 },
      replies: [
        { author: { name: second.name }, id: reply, mentions: [first.name], replyTo: top },
        { author: { name: first.name }, id: thanks, mentions: [], replyTo: top },
      ],
    });
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live(
  "an agent's inbox lists what mentions it and the replies in threads it follows, with every reason, but not what it read by replying",
  () =>
    Effect.gen(function* readInboxes() {
      const { channel, first, second } = yield* twoAgents;
      const top = yield* post(first, [channel, `Can you look at this, @${second.name}?`]);
      const reply = yield* post(second, [channel, `On it, @${first.name}.`, "--reply-to", String(top)]);
      const firstBefore = yield* inboxOf(first);
      const thanks = yield* post(first, [channel, "Thanks.", "--reply-to", String(reply)]);
      const firstAfter = yield* inboxOf(first);
      const secondInbox = yield* inboxOf(second);

      expect(firstBefore).toMatchObject({
        items: [
          { ...inboxItem(reply, ["followed-thread", "mention"]), channel: { name: channel }, parent: { id: top } },
        ],
      });
      expect(firstAfter).toStrictEqual({ items: [] });
      expect(secondInbox).toMatchObject({
        items: [inboxItem(top, ["mention"]), inboxItem(thanks, ["followed-thread"])],
      });
    }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live("an agent's ack clears its inbox items, and the next inbox run no longer shows them", () =>
  Effect.gen(function* ackInbox() {
    const { channel, first, second } = yield* twoAgents;
    const top = yield* post(first, [channel, `Can you look at this, @${second.name}?`]);
    const reply = yield* post(first, [channel, `And this, @${second.name}.`, "--reply-to", String(top)]);
    const before = yield* inboxOf(second);
    const acks = yield* Effect.all(
      [second.cookout("ack", String(top)), second.cookout("ack", String(reply))],
      ONE_AT_A_TIME,
    );
    const after = yield* inboxOf(second);

    expect(before).toMatchObject({
      items: [inboxItem(top, ["mention"]), inboxItem(reply, ["followed-thread", "mention"])],
    });
    expect(acks).toMatchObject([
      { ...succeeded, stdoutJson: { readPosition: { channel, messageId: top, thread: null } } },
      { ...succeeded, stdoutJson: { readPosition: { channel, messageId: reply, thread: top } } },
    ]);
    expect(after).toStrictEqual({ items: [] });
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live("unacked inbox items are still there for a fresh cookout process with no state of its own", () =>
  Effect.gen(function* survive() {
    const { channel, cookout, first, second } = yield* twoAgents;
    const acked = yield* post(first, [channel, `First, @${second.name}.`]);
    const unacked = yield* post(first, [channel, `Second, @${second.name}.`, "--reply-to", String(acked)]);
    const ack = yield* second.cookout("ack", String(acked));
    const leave = yield* second.cookout("leave");
    const fresh = yield* freshProcessOf(cookout, second.token)("inbox");

    expect([ack, leave, fresh]).toMatchObject([succeeded, succeeded, succeeded]);
    expect(fresh.stdoutJson).toMatchObject({ items: [inboxItem(unacked, ["followed-thread", "mention"])] });
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);
