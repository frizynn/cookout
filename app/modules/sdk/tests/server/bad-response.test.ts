import { WebhookFake, webhookFake } from "../../../webhook-fake/server.ts";
import { expect, it } from "@effect/vitest";
import { leaseId, refusal, serverAnswering } from "../../../testing/server.ts";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";

const ONE_CALL = 1;
const TEAPOT = 418;
const TEMPORARY_REDIRECT = 307;
const BAD_GATEWAY = 502;

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

it.effect("a refusal whose body isn't JSON fails with bad_response, with the body's text as its details", () =>
  Effect.gen(function* notJson() {
    const url = yield* serverAnswering({ status: BAD_GATEWAY, text: "<html>Bad gateway</html>" });
    const client = createCookoutClient({ env: {}, token: "cookout_x", url });
    const refused = yield* refusal(client.whoami);

    expect(refused).toMatchObject({ code: "bad_response", details: "<html>Bad gateway</html>", status: BAD_GATEWAY });
  }),
);

it.effect("the SDK doesn't follow a redirect, so the token and lease ID never reach another server", () =>
  Effect.gen(function* noRedirects() {
    const fake = yield* WebhookFake;
    const url = yield* serverAnswering({ body: {}, headers: { location: fake.url }, status: TEMPORARY_REDIRECT });
    const client = createCookoutClient({ env: {}, leaseId: leaseId("lease_redirected"), token: "cookout_x", url });
    const refused = yield* refusal(client.whoami);
    const calls = yield* fake.calls;

    expect(refused).toMatchObject({ code: "bad_response", status: TEMPORARY_REDIRECT });
    expect(calls).toStrictEqual([]);
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
