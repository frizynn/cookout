import { Context, DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { cookoutServer } from "../../../cli/server.ts";
import { serverUrl } from "../../../http/server.ts";
import { type CookoutClient, createCookoutClient } from "../../../sdk/index.ts";
import { secretsTest } from "../../../secrets/server.ts";
import { memoryStorage } from "../../../storage/server.ts";
import { unusableStorage } from "./storage.ts";

export const testStartTime = "2026-01-01T00:00:00.000Z";

export type TestCookoutService = {
  readonly url: string;
  readonly client: CookoutClient;
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()("cookout/testing/TestCookout") {}

export type TestCookoutOptions = {
  readonly storage?: "memory" | "unusable";
};

const storageFor = (options: TestCookoutOptions) => (options.storage === "unusable" ? unusableStorage : memoryStorage);

export const testCookout = (options: TestCookoutOptions = {}): Layer.Layer<TestCookout> =>
  Layer.effect(
    TestCookout,
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(testStartTime)));
      const server = yield* Layer.build(
        cookoutServer({ port: 0, host: "127.0.0.1" }).pipe(
          Layer.provide(Layer.mergeAll(storageFor(options), secretsTest)),
        ),
      );
      const url = yield* serverUrl.pipe(Effect.provideContext(server));
      return { url, client: createCookoutClient({ url }) };
    }).pipe(Effect.orDie),
  );
