import { Array as Arr, Effect, Option, String as Str } from "effect";
import type { Message, MessageId } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import type { TriggerCall } from "../../../triggers/server.ts";

const HUMAN = { kind: "human" } as const;
const OWNER = "fisgon";
const HELPER = "helper";
const QUIET = "quiet";
const ROUTER = "https://router.example.com/route";
const TOKEN = "trigger-secret";
const ONCE = 1;
const TWICE = 2;
const UNPROCESSABLE = 422;
const FORBIDDEN = 403;
const FIRST = 0;
const SECOND = 1;

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly owner: TestIdentity;
  readonly helper: TestIdentity;
}

const tick = TestClock.withLive(Effect.sleep("20 millis"));

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* boardWithAgents() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const owner = yield* cookout.createIdentity(OWNER, { owner: "ada" });
  const helper = yield* cookout.createIdentity(HELPER, { owner: "ada" });
  yield* cookout.createIdentity(QUIET, { owner: "ada" });
  yield* answer(() => cookout.client.createChannel({ name: "watch" }));
  yield* answer(() => cookout.client.createChannel({ name: "general" }));
  for (const agent of [OWNER, HELPER, QUIET]) {
    yield* answer(() => ada.client.setTrigger(agent, { token: TOKEN, url: `https://wake.example.com/${agent}` }));
  }
  return { ada, cookout, helper, owner };
});

const agentOf = Str.replace("https://wake.example.com/", "");

function woken(calls: readonly TriggerCall[]): readonly (readonly [string, string])[] {
  return Arr.map(calls, ({ url, wake }) => [agentOf(url), wake.reason] as const);
}

function wakeAt(calls: readonly TriggerCall[], index: number): TriggerCall["wake"] {
  return Option.getOrThrow(Arr.get(calls, index)).wake;
}

function settledCalls(cookout: TestCookoutService): Effect.Effect<readonly TriggerCall[]> {
  return Effect.andThen(tick, cookout.triggers.calls);
}

function post(who: TestIdentity, channel: string, text: string): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel, text })),
    ({ message }) => message,
  );
}

function seenIn(who: TestIdentity, parent: Message): Effect.Effect<MessageId> {
  return Effect.map(
    answer(() => who.client.getThread(parent.id)),
    ({ replies }) => Option.match(Arr.last(replies), { onNone: () => parent.id, onSome: ({ id }) => id }),
  );
}

function reply(who: TestIdentity, parent: Message, text: string): Effect.Effect<Message> {
  return Effect.gen(function* replyAfterReading() {
    const seen = yield* seenIn(who, parent);
    const { message } = yield* answer(() =>
      who.client.createMessage({ channel: parent.channel, replyTo: parent.id, seen, text }),
    );
    return message;
  });
}

it.effect("a person's unmentioned message in a channel with an owner wakes the owner with reason channel-owner", () =>
  Effect.gen(function* ownerHears() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("watch", { owner: OWNER }));
    const message = yield* post(on.ada, "watch", "what changed today?");
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);
    const inbox = yield* answer(() => on.owner.client.inbox());

    expect(message.route).toStrictEqual({ by: "channel-owner", to: [OWNER] });
    expect(wakeAt(calls, FIRST)).toStrictEqual({
      author: "ada",
      channel: "watch",
      message: message.id,
      reason: "channel-owner",
      thread: message.id,
    });
    expect(Arr.map(inbox.items, ({ message: item, reasons }) => [item.id, reasons])).toStrictEqual([
      [message.id, ["channel-owner"]],
    ]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a person's message whose only @name is no one on the board still goes to the owner", () =>
  Effect.gen(function* unknownNameRoutes() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("watch", { owner: OWNER }));
    const message = yield* post(on.ada, "watch", "hey @nobody-here can you check");

    expect([message.mentions, message.route]).toStrictEqual([[], { by: "channel-owner", to: [OWNER] }]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("an agent's message in a channel with an owner wakes no one", () =>
  Effect.gen(function* agentWakesNoOne() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("watch", { owner: OWNER }));
    const message = yield* post(on.helper, "watch", "a report");
    const calls = yield* settledCalls(on.cookout);

    expect(message.route).toBeUndefined();
    expect(calls).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a person's message that mentions someone goes only to whom it mentions, not to the owner", () =>
  Effect.gen(function* mentionWins() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("watch", { owner: OWNER }));
    yield* post(on.ada, "watch", `@${HELPER} look`);
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);
    yield* tick;

    expect(woken(calls)).toStrictEqual([[HELPER, "mention"]]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a person's unmentioned reply wakes the agents taking part in the thread, not the channel's owner", () =>
  Effect.gen(function* threadWakes() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("general", { owner: OWNER }));
    const parent = yield* post(on.ada, "general", `@${HELPER} start`);
    yield* on.cookout.triggers.waitForCalls(ONCE);
    yield* reply(on.helper, parent, "on it");
    const answered = yield* reply(on.ada, parent, "and also this");
    yield* on.cookout.triggers.waitForCalls(TWICE);
    const calls = yield* settledCalls(on.cookout);

    expect(woken(calls)).toStrictEqual([
      [HELPER, "mention"],
      [HELPER, "thread"],
    ]);
    expect(wakeAt(calls, SECOND)).toMatchObject({ message: answered.id, thread: parent.id });
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("an agent's unmentioned reply in a thread wakes no one", () =>
  Effect.gen(function* agentReplyQuiet() {
    const on = yield* board;
    const parent = yield* post(on.ada, "general", `@${HELPER} start`);
    yield* on.cookout.triggers.waitForCalls(ONCE);
    yield* reply(on.owner, parent, `@${HELPER} hi`);
    yield* on.cookout.triggers.waitForCalls(TWICE);
    yield* reply(on.helper, parent, "done");
    const calls = yield* settledCalls(on.cookout);

    expect(woken(calls)).toStrictEqual([
      [HELPER, "mention"],
      [HELPER, "mention"],
    ]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a channel's router picks who hears a person's unmentioned message, and the message says so", () =>
  Effect.gen(function* routerPicks() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("general", { router: ROUTER }));
    yield* on.cookout.triggers.routeWith({ agents: [{ confidence: 0.9, name: HELPER }, { name: "nobody" }] });
    const message = yield* post(on.ada, "general", "who knows about invoices?");
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);
    const inbox = yield* answer(() => on.helper.client.inbox());

    expect(message.route).toStrictEqual({ by: "router", to: [HELPER] });
    expect(woken(calls)).toStrictEqual([[HELPER, "routed"]]);
    expect(Arr.map(inbox.items, ({ reasons }) => reasons)).toStrictEqual([["routed"]]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a channel's router is asked with the person's message, who wrote it and the agents to pick from", () =>
  Effect.gen(function* routerAsked() {
    const on = yield* board;
    const set = yield* answer(() => on.cookout.client.setChannelRouting("general", { router: ROUTER }));
    yield* post(on.ada, "general", "who knows about invoices?");
    const asked = yield* Effect.map(on.cookout.triggers.routerCalls, (calls) => Option.getOrThrow(Arr.head(calls)));

    expect([set.channel.router, set.routerSecret]).toStrictEqual([ROUTER, expect.stringMatching(/^hmac_/u)]);
    expect(asked.body).toContain(`"name":"${HELPER}"`);
    expect(asked.body).toContain(
      '"author":"ada","channel":"general","fallback":null,"text":"who knows about invoices?"',
    );
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("when the router fails, the channel's fallback hears the message, with the router's error", () =>
  Effect.gen(function* fallsBack() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("general", { fallback: OWNER, router: ROUTER }));
    yield* on.cookout.triggers.routeWith({ error: "the router answered 500" });
    const message = yield* post(on.ada, "general", "anyone?");
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);

    expect(message.route).toStrictEqual({ by: "fallback", error: "the router answered 500", to: [OWNER] });
    expect(woken(calls)).toStrictEqual([[OWNER, "routed"]]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("when the router picks no one and there's no fallback, the message has no route and wakes no one", () =>
  Effect.gen(function* nobody() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("general", { router: ROUTER }));
    const message = yield* post(on.ada, "general", "just thinking out loud");
    const calls = yield* settledCalls(on.cookout);

    expect(message.route).toBeUndefined();
    expect(calls).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("only an admin changes a channel's routing or the board's limits", () =>
  Effect.gen(function* adminsOnly() {
    const on = yield* board;
    const routing = yield* refusal(() => on.ada.client.setChannelRouting("watch", { owner: OWNER }));
    const limits = yield* refusal(() => on.ada.client.setBoardLimits({ agentMentions: 3, agentTurns: 3 }));

    expect([routing, limits]).toMatchObject([
      { code: "admin_only", status: FORBIDDEN },
      { code: "admin_only", status: FORBIDDEN },
    ]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a channel's routing refuses a person as owner, an owner beside a router and a fallback alone", () =>
  Effect.gen(function* refusedRouting() {
    const on = yield* board;
    const admin = on.cookout.client;
    const person = yield* refusal(() => admin.setChannelRouting("watch", { owner: "ada" }));
    const both = yield* refusal(() => admin.setChannelRouting("watch", { owner: OWNER, router: ROUTER }));
    const alone = yield* refusal(() => admin.setChannelRouting("watch", { fallback: OWNER }));
    const cleared = yield* answer(() => admin.setChannelRouting("watch", {}));

    expect([person, both, alone]).toMatchObject([
      { code: "routing_agent_invalid", status: UNPROCESSABLE },
      { code: "routing_conflict", status: UNPROCESSABLE },
      { code: "routing_conflict", status: UNPROCESSABLE },
    ]);
    expect(cleared.channel).toStrictEqual({ createdAt: cleared.channel.createdAt, name: "watch" });
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("the router secret is shown once, and kept while the router URL stays the same", () =>
  Effect.gen(function* secretOnce() {
    const on = yield* board;
    const first = yield* answer(() => on.cookout.client.setChannelRouting("general", { router: ROUTER }));
    const again = yield* answer(() =>
      on.cookout.client.setChannelRouting("general", { fallback: OWNER, router: ROUTER }),
    );
    const moved = yield* answer(() => on.cookout.client.setChannelRouting("general", { router: `${ROUTER}/v2` }));
    const listed = yield* answer(() => on.cookout.client.getChannel("general"));

    expect(first.routerSecret).toBeTypeOf("string");
    expect(moved.routerSecret).toBeTypeOf("string");
    expect([
      "routerSecret" in again,
      moved.routerSecret === first.routerSecret,
      "routerSecret" in listed.channel,
    ]).toStrictEqual([false, false, false]);
    expect(listed.channel).toMatchObject({ router: `${ROUTER}/v2` });
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);
