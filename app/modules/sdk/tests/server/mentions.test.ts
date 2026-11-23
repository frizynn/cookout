import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("an @name of an existing identity is a mention, and an unknown one stays text and is reported", () =>
  Effect.gen(function* mentionByName() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller");
    yield* cookout.createIdentity("reviewer");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const posted = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", text: "@reviewer and @reveiwer, look (cc @reviewer)" }),
    );

    expect(posted.message.mentions).toStrictEqual(["reviewer"]);
    expect(posted.message.text).toBe("@reviewer and @reveiwer, look (cc @reviewer)");
    expect(posted.unknownMentions).toStrictEqual(["reveiwer"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("@channel and @here mention nobody", () =>
  Effect.gen(function* noBroadcastMentions() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("auth-griller");
    yield* cookout.createIdentity("reviewer");
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    const posted = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "@channel @here ping" }));

    expect(posted.message.mentions).toStrictEqual([]);
    expect(posted.unknownMentions).toStrictEqual(["channel", "here"]);
  }).pipe(Effect.provide(testCookout())),
);
