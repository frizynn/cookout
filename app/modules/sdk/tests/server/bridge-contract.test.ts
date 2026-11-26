import { Array as Arr, Effect, Function as Fn, Option, String as Str } from "effect";
import type { Message, MessageId } from "../../index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import routeRequest from "../../../../../docs/bridge-contract/route-request.json" with { type: "json" };
import routeResponse from "../../../../../docs/bridge-contract/route-response.json" with { type: "json" };
import wake from "../../../../../docs/bridge-contract/wake.json" with { type: "json" };
import wakeEphemeral from "../../../../../docs/bridge-contract/wake-ephemeral.json" with { type: "json" };

const BOARD = "https://board.example";
const WAKE = { effort: "high", harness: "claude", model: "sonnet" } as const;
const ROUTER_DOWN = 500;
const FIRST = 0;
const ONCE = 1;
const TWICE = 2;
const THRICE = 3;

interface Sent {
  readonly url: string;
  readonly thread: MessageId;
  readonly message: MessageId;
}

interface ContractWake {
  readonly message: number;
  readonly thread: number;
  readonly text: string;
}

function onThisBoard<Body extends ContractWake>(body: Body, { message, thread, url }: Sent): Body {
  const contractLink = `/threads/${String(body.thread)}/messages/${String(body.message)}`;
  const link = `/threads/${String(thread)}/messages/${String(message)}`;
  return {
    ...body,
    message,
    text: Fn.pipe(body.text, Str.replace(BOARD, url), Str.replace(contractLink, link)),
    thread,
  };
}

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly helper: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* boardWithTwoBots() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", { kind: "human" });
  yield* cookout.createIdentity("billing-bot", { owner: "ada" });
  const helper = yield* cookout.createIdentity("helper-bot", { owner: "ada" });
  yield* answer(() => cookout.client.setDescription("billing-bot", "answers billing questions"));
  yield* answer(() => cookout.client.setDisplayName("billing-bot", "Billing"));
  yield* answer(() => cookout.client.createChannel({ name: "general" }));
  yield* Effect.forEach(
    ["billing-bot", "helper-bot"],
    (name) =>
      answer(() => ada.client.setTrigger(name, { token: "trigger-secret", url: `${cookout.webhook.url}/${name}` })),
    { concurrency: "unbounded" },
  );
  return { ada, cookout, helper };
});

function routed(on: Board): Effect.Effect<void> {
  const router = `${on.cookout.webhook.url}/route`;
  return Effect.asVoid(
    answer(() =>
      on.cookout.client.setChannelRouting("general", { fallback: "helper-bot", fallbackWake: WAKE, router }),
    ),
  );
}

interface InThread {
  readonly replyTo: MessageId;
  readonly seen: MessageId;
}

function posted(who: TestIdentity, text: string, thread?: InThread): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "general", text, ...thread })),
    ({ message }) => message,
  );
}

function bodyAt(calls: readonly { readonly body: unknown }[], index: number): unknown {
  return Option.getOrThrow(Arr.get(calls, index)).body;
}

it.effect("the router is asked with route-request.json, and route-response.json routes the message", () =>
  Effect.gen(function* routerContract() {
    const on = yield* board;
    yield* routed(on);
    yield* on.cookout.webhook.answerWith(routeResponse);
    yield* posted(on.ada, "who knows?");
    const calls = yield* on.cookout.webhook.waitForCalls(TWICE);

    expect(bodyAt(calls, FIRST)).toStrictEqual(routeRequest);
    expect(Arr.map(calls, ({ path }) => path)).toStrictEqual(["/route", "/billing-bot"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a mention in a thread wakes the agent with wake.json", () =>
  Effect.gen(function* mentionContract() {
    const on = yield* board;
    const top = yield* posted(on.ada, "who knows?");
    const reply = yield* posted(on.ada, "@helper-bot anyone around?", { replyTo: top.id, seen: top.id });
    const calls = yield* on.cookout.webhook.waitForCalls(ONCE);
    const sent = { message: reply.id, thread: top.id, url: on.cookout.url };

    expect(bodyAt(calls, FIRST)).toStrictEqual(onThisBoard(wake, sent));
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a reply to a fallback that wakes in a new session sends wake-ephemeral.json", () =>
  Effect.gen(function* ephemeralContract() {
    const on = yield* board;
    yield* routed(on);
    yield* on.cookout.webhook.failNext(ONCE, ROUTER_DOWN, Option.none());
    const top = yield* posted(on.ada, "who knows?");
    yield* on.cookout.webhook.waitForCalls(TWICE);
    const here = yield* posted(on.helper, "here", { replyTo: top.id, seen: top.id });
    const reply = yield* posted(on.ada, "anyone around?", { replyTo: top.id, seen: here.id });
    const calls = yield* on.cookout.webhook.waitForCalls(THRICE);
    const sent = { message: reply.id, thread: top.id, url: on.cookout.url };

    expect(bodyAt(calls, TWICE)).toStrictEqual(onThisBoard(wakeEphemeral, sent));
  }).pipe(Effect.provide(testCookout())),
);
