import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("the caller's read positions list each channel and thread it has acked in, and only its own", () =>
  Effect.gen(function* readPositions() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    const { message: parent } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "parent" }));
    const { message: reply } = yield* answer(() =>
      ann.client.createMessage({ channel: "grill", replyTo: parent.id, text: "reply" }),
    );
    const before = yield* answer(() => bob.client.readPositions());
    yield* answer(() => bob.client.ack(reply.id));
    const after = yield* answer(() => bob.client.readPositions());

    expect([before, after]).toStrictEqual([
      { readPositions: [] },
      { readPositions: [{ channel: "grill", messageId: reply.id, thread: parent.id }] },
    ]);
  }).pipe(Effect.provide(testCookout())),
);
