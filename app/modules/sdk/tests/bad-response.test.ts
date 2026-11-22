import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { startWebhookFake } from "../../webhook-fake/server.ts";
import { createCookoutClient } from "../index.ts";

const notCookout = Effect.acquireRelease(
  Effect.promise(() => startWebhookFake()),
  (fake) => Effect.promise(() => fake.stop()),
);

it.effect("an answer that isn't the cookout protocol fails with bad_response", () =>
  Effect.gen(function* () {
    const fake = yield* notCookout;
    const client = createCookoutClient({ url: fake.url, token: "cookout_x", env: {} });
    const error = yield* Effect.promise(() => client.listIdentities().catch((caught: unknown) => caught));
    expect(error).toMatchObject({ status: 200, code: "bad_response", details: { ok: true } });
    fake.failNext(1);
    const refused = yield* Effect.promise(() => client.rotateToken("agent").catch((caught: unknown) => caught));
    expect(refused).toMatchObject({ status: 500, code: "bad_response" });
  }).pipe(Effect.scoped),
);
