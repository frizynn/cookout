import { WebhookFake, webhookFake } from "../../../webhook-fake/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";
import { refusal } from "../../../testing/server.ts";

const ONE_CALL = 1;

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
