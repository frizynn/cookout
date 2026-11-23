import { answer, messageId, refusal, serverAnswering } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";

const PARENT = 1;
const base = {
  author: { name: "agent" },
  channel: "grill",
  createdAt: "2026-01-01T00:00:00.000Z",
  mentions: [],
  text: "hi",
};
const topLevel = { ...base, id: 1, kind: "top-level", latestReplyId: 2, replyCount: 1 };
const reply = { ...base, id: 2, kind: "reply", replyTo: 1 };

function threadAnswered(body: unknown): Effect.Effect<unknown> {
  return Effect.scoped(
    Effect.gen(function* askThread() {
      const url = yield* serverAnswering({ body });
      const client = createCookoutClient({ env: {}, token: "cookout_x", url });
      return yield* answer(() => client.getThread(messageId(PARENT)));
    }),
  );
}

function threadRefused(body: unknown): Effect.Effect<unknown> {
  return Effect.scoped(
    Effect.gen(function* askThread() {
      const url = yield* serverAnswering({ body });
      const client = createCookoutClient({ env: {}, token: "cookout_x", url });
      return yield* refusal(() => client.getThread(messageId(PARENT)));
    }),
  );
}

it.effect("a message is either top-level (with reply count) or a reply (with replyTo)", () =>
  Effect.gen(function* messageKinds() {
    const thread = yield* threadAnswered({ parent: topLevel, replies: [reply] });
    const untagged = yield* threadRefused({ parent: { ...base, id: 1, latestReplyId: 2, replyCount: 1 }, replies: [] });
    const replyWithoutReplyTo = yield* threadRefused({
      parent: topLevel,
      replies: [{ ...base, id: 2, kind: "reply" }],
    });
    const topLevelWithoutCount = yield* threadRefused({ parent: { ...base, id: 1, kind: "top-level" }, replies: [] });
    const badResponse = { code: "bad_response", status: 200 };

    expect(thread).toStrictEqual({ parent: topLevel, replies: [reply] });
    expect([untagged, replyWithoutReplyTo, topLevelWithoutCount]).toMatchObject([
      badResponse,
      badResponse,
      badResponse,
    ]);
  }),
);
