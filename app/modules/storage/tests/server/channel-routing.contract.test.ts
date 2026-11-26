import { Array as Arr, Effect, Option, Predicate, String as Str } from "effect";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  identityFixture as identity,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const AGENTS = [
  ["ann", "a"],
  ["watcher", "w"],
  ["helper", "h"],
] as const;
const OWNER = nameOf("watcher");
const SECRET = "hmac_test";
const WAKE = { effort: "high", harness: "claude", model: "sonnet" } as const;
const OWNED = { ...channel("ops", { description: "Ops" }), owner: OWNER };

it.effect.each(storageLayers)(
  "storage contract ($adapter): a channel's routing and its router secret are replaced together, and cleared",
  ({ layer }) =>
    Effect.gen(function* routing() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("ops", { description: "Ops" }));
      const routed = yield* storage.setChannelRouting(channelName("ops"), {
        routerSecret: SECRET,
        routing: { fallback: OWNER, router: "https://router.example.com/route" },
      });
      const secret = yield* storage.findRouterSecret(channelName("ops"));
      const owned = yield* storage.setChannelRouting(channelName("ops"), { routing: { owner: OWNER } });
      const gone = yield* Effect.all(
        [
          storage.findRouterSecret(channelName("ops")),
          storage.setChannelRouting(channelName("nowhere"), { routing: {} }),
        ],
        { concurrency: 1 },
      );
      const listed = yield* storage.listChannels();

      expect(routed).toMatchObject({ fallback: OWNER, name: "ops", router: "https://router.example.com/route" });
      expect([secret, ...Arr.map(gone, Predicate.isUndefined)]).toStrictEqual([SECRET, true, true]);
      expect([owned, listed]).toStrictEqual([OWNED, [OWNED]]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a channel's fallback wake is kept with its routing and read back",
  ({ layer }) =>
    Effect.gen(function* wake() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("ops", { description: "Ops" }));
      const routed = yield* storage.setChannelRouting(channelName("ops"), {
        routing: { fallback: OWNER, fallbackWake: WAKE, router: "https://router.example.com/route" },
      });
      const found = yield* storage.findChannel(channelName("ops"));

      expect([routed, found]).toMatchObject([{ fallbackWake: WAKE }, { fallbackWake: WAKE }]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): the board's limits are the defaults until set",
  ({ layer }) =>
    Effect.gen(function* limits() {
      const { storage } = yield* openStore(layer);
      const before = yield* storage.getBoardLimits();
      yield* storage.setBoardLimits({ agentMentions: 3, agentTurns: 9 });
      const after = yield* storage.getBoardLimits();

      expect([before, after]).toStrictEqual([
        { agentMentions: 1, agentTurns: 6 },
        { agentMentions: 3, agentTurns: 9 },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a routed message keeps its route and reaches each routed agent's inbox with its reason",
  ({ layer }) =>
    Effect.gen(function* routedInbox() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("ops"));
      yield* Effect.forEach(
        AGENTS,
        ([name, letter]) => storage.createIdentity(identity(name), tokenHash(Str.repeat(HASH_LENGTH)(letter))),
        { concurrency: 1 },
      );
      const [owned, routed] = yield* Effect.all(
        [
          appendTo(storage)({
            ...newMessage("ops", "what changed?", { author: { name: "ann" } }),
            route: { by: "channel-owner", to: [OWNER] },
          }),
          appendTo(storage)({
            ...newMessage("ops", "anyone?", { author: { name: "ann" } }),
            route: { by: "fallback", error: "the router answered 500", to: [nameOf("helper")] },
          }),
        ],
        { concurrency: 1 },
      );
      const thread = yield* storage.getThread(routed.id);
      const watcher = yield* storage.listInbox(OWNER);
      const helper = yield* storage.listInbox(nameOf("helper"));

      expect(Option.getOrThrow(Option.fromUndefinedOr(thread)).parent.route).toStrictEqual({
        by: "fallback",
        error: "the router answered 500",
        to: ["helper"],
      });
      expect(Arr.map(watcher, ({ message, reasons }) => [message.id, reasons])).toStrictEqual([
        [owned.id, ["channel-owner"]],
      ]);
      expect(Arr.map(helper, ({ message, reasons }) => [message.id, reasons])).toStrictEqual([[routed.id, ["routed"]]]);
    }),
);
