import {
  appendTo,
  channelFixture as channel,
  commandFixture as command,
  handlerFixture as handler,
  identityName,
  isoTime,
  messageId,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { tokenHash } from "../../../identities/index.ts";

const ANY_THREAD = 1;
const expiresAt = isoTime("2026-01-02T00:00:00.000Z");

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command token is found by its hash with its handler, thread and expiry",
  ({ layer }) =>
    Effect.gen(function* foundByHash() {
      const { storage } = yield* openStore(layer);
      yield* storage.addCommand(command("deploy"), handler("deploy"));
      yield* storage.createChannel(channel("grill"));
      const call = yield* appendTo(storage)(newMessage("grill", "/deploy"));
      yield* storage.addCommandToken({
        expiresAt,
        handler: identityName("deploy"),
        hash: tokenHash("hash:command"),
        threadId: call.id,
      });
      const found = yield* storage.findCommandToken(tokenHash("hash:command"));
      const missing = yield* storage.findCommandToken(tokenHash("hash:other"));

      expect(found).toStrictEqual({ expiresAt, handler: handler("deploy"), threadId: call.id });
      expect(missing).toBeUndefined();
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a command token whose handler identity was deleted is not found",
  ({ layer }) =>
    Effect.gen(function* handlerDeleted() {
      const { storage } = yield* openStore(layer);
      yield* storage.addCommand(command("deploy"), handler("deploy"));
      yield* storage.createChannel(channel("grill"));
      const call = yield* appendTo(storage)(newMessage("grill", "/deploy"));
      yield* storage.addCommandToken({
        expiresAt,
        handler: identityName("deploy"),
        hash: tokenHash("hash:command"),
        threadId: call.id,
      });
      yield* storage.deleteIdentity(identityName("deploy"));
      const found = yield* storage.findCommandToken(tokenHash("hash:command"));

      expect(found).toBeUndefined();
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a closed store can't add or find a command token",
  ({ layer }) =>
    Effect.gen(function* closed() {
      const { close, storage } = yield* openStore(layer);
      yield* close;
      const hash = tokenHash("hash:command");
      const grant = { expiresAt, handler: identityName("deploy"), hash, threadId: messageId(ANY_THREAD) };
      const failures = yield* Effect.all(
        [Effect.flip(storage.addCommandToken(grant)), Effect.flip(storage.findCommandToken(hash))],
        { concurrency: 1 },
      );

      expect(failures).toMatchObject([{ _tag: "StorageUnavailable" }, { _tag: "StorageUnavailable" }]);
    }),
);
