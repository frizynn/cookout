import { onTestFinished } from "vitest";
import type { CookoutClient } from "@ai-hero/cookout-client";
import { createCookoutClient } from "@ai-hero/cookout-client";
import type { StorageAdapter } from "@ai-hero/cookout-protocol";
import { createMemoryStorage } from "@ai-hero/cookout-storage-memory";
import type { FakeClock } from "./fake-clock.ts";
import { createFakeClock } from "./fake-clock.ts";
import type { FakeWebhookReceiver } from "./fake-webhook-receiver.ts";
import { startFakeWebhookReceiver } from "./fake-webhook-receiver.ts";
import { startServer } from "../src/index.ts";

export type TestServer = {
  /** The server's base URL, e.g. `http://127.0.0.1:54321`. */
  url: string;
  /** An SDK client pointed at the server. */
  client: CookoutClient;
  /** The server's clock. Move it with `advance`; never sleep. */
  clock: FakeClock;
  /** The fresh in-memory store the server was given. */
  storage: StorageAdapter;
  /** A local webhook receiver for command handlers. */
  webhooks: FakeWebhookReceiver;
};

export type TestServerOptions = {
  /** Where the fake clock starts. Default 2026-01-01T00:00:00.000Z. */
  startTime?: Date;
};

/**
 * The protocol test helper: a real server on port 0 with a fresh in-memory
 * store, a fake clock and a fake webhook receiver, plus an SDK client.
 * Everything is shut down when the current test ends.
 */
export async function startTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const clock = createFakeClock(options.startTime ?? new Date("2026-01-01T00:00:00.000Z"));
  const storage = createMemoryStorage();
  const webhooks = await startFakeWebhookReceiver();
  const server = await startServer({ storage, clock, port: 0, host: "127.0.0.1" });
  onTestFinished(async () => {
    await server.close();
    await storage.close();
  });
  return {
    url: server.url,
    client: createCookoutClient({ url: server.url }),
    clock,
    storage,
    webhooks,
  };
}
