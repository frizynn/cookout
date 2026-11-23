import { Effect, String as Str } from "effect";
import {
  callId,
  channelFixture as channel,
  commandFixture as command,
  commandName,
  handlerFixture as handler,
  identityName,
  isoTime,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { NewCommandCall } from "../../../storage/server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const HASH = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const startedAt = isoTime("2026-01-01T00:00:00.000Z");
const expiresAt = isoTime("2026-01-02T00:00:00.000Z");

function deployCall(channelName: string): NewCommandCall {
  return {
    delivery: {
      attempts: 0,
      callId: callId("call_1"),
      command: commandName("deploy"),
      data: { branch: "main" },
      nextAttemptAt: startedAt,
      outcome: "pending",
    },
    message: newMessage(channelName, "/deploy", { data: { command: "deploy", data: { branch: "main" } } }),
    token: { expiresAt, handler: identityName("deploy"), hash: HASH },
  };
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command call stores its message, its pending delivery and its token in its thread",
  ({ layer }) =>
    Effect.gen(function* storedTogether() {
      const { storage } = yield* openStore(layer);
      yield* storage.addCommand(command("deploy"), handler("deploy"));
      yield* storage.createChannel(channel("grill"));
      const message = yield* storage.appendCommandCall(deployCall("grill")).pipe(
        Effect.filterOrFail((result) => result.status === "appended"),
        Effect.map((result) => result.message),
        Effect.orDie,
      );
      const pending = yield* storage.listPendingDeliveries;
      const grant = yield* storage.findCommandToken(HASH);
      const threadId = message.id;

      expect(message).toMatchObject({ channel: "grill", text: "/deploy" });
      expect(pending).toStrictEqual([{ ...deployCall("grill").delivery, channel: "grill", threadId }]);
      expect(grant).toMatchObject({ expiresAt, handler: { name: "deploy" }, threadId });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command call into a missing channel stores no message, delivery or token",
  ({ layer }) =>
    Effect.gen(function* storedNothing() {
      const { storage } = yield* openStore(layer);
      yield* storage.addCommand(command("deploy"), handler("deploy"));
      const result = yield* storage.appendCommandCall(deployCall("lounge"));
      const pending = yield* storage.listPendingDeliveries;
      const grant = yield* storage.findCommandToken(HASH);

      expect(result).toStrictEqual({ status: "channel_not_found" });
      expect(pending).toStrictEqual([]);
      expect(grant).toBeUndefined();
    }),
);
