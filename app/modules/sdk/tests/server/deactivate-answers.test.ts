import { answer, serverAnswering } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { createCookoutClient } from "../../index.ts";

const OK = 200;
const ada = { admin: false, createdAt: "2026-11-24T00:00:00.000Z", deactivated: true, kind: "human", name: "ada" };

it.effect("the SDK accepts a deactivate answer that is only the identity", () =>
  Effect.gen(function* onlyTheIdentity() {
    const url = yield* serverAnswering({ body: { identity: ada }, status: OK });
    const client = createCookoutClient({ env: {}, token: "cookout_x", url });
    const deactivated = yield* answer(() => client.deactivateIdentity("ada"));

    expect(deactivated).toStrictEqual({ identity: ada });
  }),
);
