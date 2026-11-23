import { Array as Arr, Effect, Order, String as Str, pipe } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { isMessageId, messagesPath } from "../../../messages/index.ts";
import { TestClock } from "effect/testing";

const BAD_REQUEST = 400;
const FOUR_POSTS = 4;
const NO_REPLIES = 0;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const OVER_A_MEBIBYTE = 1_048_577;
const PAYLOAD_TOO_LARGE = 413;
const BAD_BODIES = [
  { channel: "grill" },
  { channel: "grill", text: "" },
  { channel: "grill", replyTo: "one", text: "hi" },
  { channel: "grill", text: 7 },
] as const;

function refusedOn(field: string): object {
  return { json: { error: { code: "invalid_request", details: [{ path: [field] }] } }, status: BAD_REQUEST };
}

function withChannel(cookout: TestCookoutService): Effect.Effect<TestIdentity> {
  return Effect.gen(function* identityWithChannel() {
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    return agent;
  });
}

it.effect("an identity posts a top-level message with JSON data, and sees its author and owner", () =>
  Effect.gen(function* postTopLevel() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    yield* TestClock.adjust("5 seconds");
    const data = { note: null, open: true, question: 1, tags: ["idle-expiry"] };
    const { message } = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", data, text: "Is the idle expiry 7 days?" }),
    );

    expect(message).toStrictEqual({
      author: { name: "auth-griller", owner: "matt" },
      channel: "grill",
      createdAt: "2026-01-01T00:00:05.000Z",
      data,
      id: message.id,
      kind: "top-level",
      latestReplyAt: null,
      latestReplyId: null,
      mentions: [],
      repliers: [],
      replyCount: NO_REPLIES,
      text: "Is the idle expiry 7 days?",
    });
    expect(isMessageId(message.id)).toBe(true);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human author has no owner on its messages", () =>
  Effect.gen(function* noOwner() {
    const cookout = yield* TestCookout;
    yield* withChannel(cookout);
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    const { message } = yield* answer(() => ada.client.createMessage({ channel: "grill", text: "hello" }));

    expect(message.author).toStrictEqual({ name: "ada" });
    expect(message).not.toHaveProperty("data");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("posting to a missing channel is a 404", () =>
  Effect.gen(function* missingChannel() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const error = yield* refusal(() => agent.client.createMessage({ channel: "nowhere", text: "hi" }));

    expect(error).toMatchObject({ code: "channel_not_found", status: 404 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("replying to a missing message is a 404 and posts nothing", () =>
  Effect.gen(function* missingParent() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const error = yield* refusal(() => agent.client.createMessage({ channel: "grill", replyTo: 999, text: "hi" }));
    const page = yield* answer(() => agent.client.listMessages("grill"));

    expect(error).toMatchObject({ code: "message_not_found", status: 404 });
    expect(page.messages).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("replying to a message in another channel is refused with 400 and posts nothing", () =>
  Effect.gen(function* otherChannel() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    yield* answer(() => agent.client.createChannel({ name: "other" }));
    const { message: parent } = yield* answer(() => agent.client.createMessage({ channel: "other", text: "parent" }));
    const error = yield* refusal(() =>
      agent.client.createMessage({ channel: "grill", replyTo: parent.id, text: "hi" }),
    );
    const thread = yield* answer(() => agent.client.getThread(parent.id));

    expect(error).toMatchObject({ code: "reply_in_other_channel", status: BAD_REQUEST });
    expect(thread.replies).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a bad message body is refused with 400 and the schema errors", () =>
  Effect.gen(function* badBody() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const answers = yield* pipe(
      BAD_BODIES,
      Effect.forEach(
        (body) =>
          HttpClientRequest.post(`${cookout.url}${messagesPath}`).pipe(
            HttpClientRequest.setHeader("authorization", `Bearer ${agent.token}`),
            HttpClientRequest.bodyJsonUnsafe(body),
            HttpClient.execute,
            Effect.flatMap((response) => Effect.map(response.json, (json) => ({ json, status: response.status }))),
          ),
        ONE_AT_A_TIME,
      ),
    );
    const page = yield* answer(() => agent.client.listMessages("grill"));

    expect(answers).toMatchObject([refusedOn("text"), refusedOn("text"), refusedOn("replyTo"), refusedOn("text")]);
    expect(page.messages).toStrictEqual([]);
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);

it.effect("a body over 1 MiB is refused with 413 body_too_large and posts nothing", () =>
  Effect.gen(function* bodyTooLarge() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const text = Str.repeat(OVER_A_MEBIBYTE)("x");
    const error = yield* refusal(() => agent.client.createMessage({ channel: "grill", text }));
    const page = yield* answer(() => agent.client.listMessages("grill"));

    expect(error).toMatchObject({ code: "body_too_large", status: PAYLOAD_TOO_LARGE });
    expect(page.messages).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("posting needs a token", () =>
  Effect.gen(function* postingNeedsAToken() {
    const cookout = yield* TestCookout;
    yield* withChannel(cookout);
    const error = yield* refusal(() => cookout.clientFor("").createMessage({ channel: "grill", text: "hi" }));

    expect(error).toMatchObject({ code: "token_missing", status: 401 });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("message IDs increase across channels", () =>
  Effect.gen(function* increasingIds() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    yield* answer(() => agent.client.createChannel({ name: "other" }));
    const posted = yield* pipe(
      ["grill", "other", "grill", "other"],
      Effect.forEach((channel) => answer(() => agent.client.createMessage({ channel, text: "hi" })), ONE_AT_A_TIME),
    );
    const ids = Arr.map(posted, ({ message }) => message.id);

    expect(Arr.sort(ids, Order.Number)).toStrictEqual(ids);
    expect(new Set(ids).size).toBe(FOUR_POSTS);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a message keeps its author's name and owner after the identity is deactivated", () =>
  Effect.gen(function* authorKept() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const { message } = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "still here" }));
    yield* answer(() => cookout.client.deactivateIdentity("auth-griller"));
    const thread = yield* answer(() => cookout.client.getThread(message.id));

    expect(thread.parent.author).toStrictEqual({ name: "auth-griller", owner: "matt" });
  }).pipe(Effect.provide(testCookout())),
);
