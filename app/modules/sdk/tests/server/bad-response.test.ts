import { WebhookFake, webhookFake } from "../../../webhook-fake/server.ts";
import { expect, it } from "@effect/vitest";
import { refusal, serverAnswering } from "../../../testing/server.ts";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";

const ONE_CALL = 1;
const TEAPOT = 418;

it.effect("an answer that isn't the cookout protocol fails with bad_response", () =>
  Effect.gen(function* notTheProtocol() {
    const fake = yield* WebhookFake;
    const client = createCookoutClient({ env: {}, token: "cookout_x", url: fake.url });
    const answered = yield* refusal(client.listIdentities);
    yield* fake.failNext(ONE_CALL);
    const refused = yield* refusal(() => client.rotateToken("agent"));

    expect(answered).toMatchObject({ code: "bad_response", details: { ok: true }, status: 200 });
    expect(refused).toMatchObject({ code: "bad_response", status: 500 });
  }).pipe(Effect.provide(webhookFake)),
);

it.effect("an error code the SDK doesn't know passes through as a refusal, not bad_response", () =>
  Effect.gen(function* unknownErrorCode() {
    const error = { code: "kettle_empty", details: { kettle: 1 }, message: "The kettle is empty." };
    const url = yield* serverAnswering({ body: { error }, status: TEAPOT });
    const client = createCookoutClient({ env: {}, token: "cookout_x", url });
    const refused = yield* refusal(client.whoami);

    expect(refused).toMatchObject({ ...error, status: TEAPOT });
  }),
);
