import { Array as Arr, Context, Effect, Layer, Random, Redacted, String as Str } from "effect";
import type { BinNeeds, BinResult, BinRun } from "./bin.ts";
import type { ChannelResponse, CookoutClient, IdentityWithTokenResponse } from "@ai-hero/cookout/sdk";
import { e2eAdminToken, e2eUrl } from "../../../config/server.ts";
import type { Config } from "effect";
import type { JoinAgent } from "./session.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";
import { joinAgentWith } from "./session.ts";
import { runBin } from "./bin.ts";

interface CookoutUnderTestService {
  readonly url: string;
  readonly prefix: string;
  readonly admin: CookoutClient;
  readonly createAgent: (name: string) => Effect.Effect<IdentityWithTokenResponse>;
  readonly createHuman: (name: string) => Effect.Effect<IdentityWithTokenResponse>;
  readonly createChannel: (name: string) => Effect.Effect<ChannelResponse>;
  readonly runCookout: (run: BinRun) => Effect.Effect<BinResult, never, BinNeeds>;
  readonly joinAgent: JoinAgent;
}

const NO_DRAW = 0;
const PREFIX_RADIX = 36;
const PREFIX_LENGTH = 8;
const PREFIX_SPACE = PREFIX_RADIX ** PREFIX_LENGTH;
const ONE_AT_A_TIME = { concurrency: 1, discard: true } as const;

class CookoutUnderTest extends Context.Service<CookoutUnderTest, CookoutUnderTestService>()(
  "@ai-hero/cookout-e2e/cookout/lib/server/cookout-under-test/CookoutUnderTest",
) {}

function prefixOf(draw: number): string {
  return `e2e-${Str.padStart(PREFIX_LENGTH, "0")(draw.toString(PREFIX_RADIX))}`;
}

function deleteRunIdentities(admin: CookoutClient, prefix: string): Effect.Effect<void> {
  return Effect.gen(function* deleteOwn() {
    const { identities } = yield* Effect.promise(() => admin.listIdentities());
    const own = Arr.filter(identities, ({ name }) => Str.startsWith(`${prefix}-`)(name));
    yield* Effect.forEach(own, ({ name }) => Effect.promise(() => admin.deleteIdentity(name)), ONE_AT_A_TIME);
  });
}

function deleteChannelsStartingWith(admin: CookoutClient, start: string): Effect.Effect<void> {
  return Effect.gen(function* deleteChannels() {
    const { channels } = yield* Effect.promise(() => admin.listChannels());
    const own = Arr.filter(channels, ({ name }) => Str.startsWith(start)(name));
    yield* Effect.forEach(own, ({ name }) => Effect.promise(() => admin.deleteChannel(name)), ONE_AT_A_TIME);
  });
}

interface AdminConnection {
  readonly admin: CookoutClient;
  readonly url: string;
}

const adminClient: Effect.Effect<AdminConnection, Config.ConfigError> = Effect.gen(function* connectAdmin() {
  const url = yield* e2eUrl;
  const adminToken = yield* e2eAdminToken;
  return { admin: createCookoutClient({ token: Redacted.value(adminToken), url }), url };
});

const deleteE2eChannels: Effect.Effect<void> = Effect.flatMap(adminClient, ({ admin }) =>
  deleteChannelsStartingWith(admin, "e2e-"),
).pipe(Effect.orDie);

const cookoutUnderTest: Layer.Layer<CookoutUnderTest> = Layer.effect(
  CookoutUnderTest,
  Effect.gen(function* startRun() {
    const { admin, url } = yield* adminClient;
    const draw = yield* Random.nextIntBetween(NO_DRAW, PREFIX_SPACE);
    const prefix = prefixOf(draw);
    yield* Effect.addFinalizer(() =>
      Effect.andThen(deleteRunIdentities(admin, prefix), deleteChannelsStartingWith(admin, `${prefix}-`)),
    );
    function createAgent(name: string): Effect.Effect<IdentityWithTokenResponse> {
      return Effect.promise(() => admin.createIdentity({ kind: "agent", name: `${prefix}-${name}` }));
    }
    const runCookout = runBin(url);
    return {
      admin,
      createAgent,
      createChannel: (name: string) => Effect.promise(() => admin.createChannel({ name: `${prefix}-${name}` })),
      createHuman: (name: string) =>
        Effect.promise(() => admin.createIdentity({ kind: "human", name: `${prefix}-${name}` })),
      joinAgent: joinAgentWith({ createAgent, runCookout, url }),
      prefix,
      runCookout,
      url,
    };
  }).pipe(Effect.orDie),
);

export { CookoutUnderTest, type CookoutUnderTestService, cookoutUnderTest, deleteE2eChannels };
