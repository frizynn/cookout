import { Array as Arr, Context, Effect, Layer, Random, Redacted, String as Str } from "effect";
import type { BinNeeds, BinResult, BinRun } from "./bin.ts";
import type { CookoutClient, IdentityWithTokenResponse } from "@ai-hero/cookout/sdk";
import { e2eAdminToken, e2eUrl } from "../../../config/server.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";
import { runBin } from "./bin.ts";

interface CookoutUnderTestService {
  readonly url: string;
  readonly prefix: string;
  readonly admin: CookoutClient;
  readonly createIdentity: (name: string) => Effect.Effect<IdentityWithTokenResponse>;
  readonly runCookout: (run: BinRun) => Effect.Effect<BinResult, never, BinNeeds>;
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

const cookoutUnderTest: Layer.Layer<CookoutUnderTest> = Layer.effect(
  CookoutUnderTest,
  Effect.gen(function* startRun() {
    const url = yield* e2eUrl;
    const adminToken = yield* e2eAdminToken;
    const admin = createCookoutClient({ token: Redacted.value(adminToken), url });
    const draw = yield* Random.nextIntBetween(NO_DRAW, PREFIX_SPACE);
    const prefix = prefixOf(draw);
    yield* Effect.addFinalizer(() => deleteRunIdentities(admin, prefix));
    return {
      admin,
      createIdentity: (name: string) => Effect.promise(() => admin.createIdentity({ name: `${prefix}-${name}` })),
      prefix,
      runCookout: runBin(url),
      url,
    };
  }).pipe(Effect.orDie),
);

export { CookoutUnderTest, type CookoutUnderTestService, cookoutUnderTest };
