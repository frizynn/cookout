import { onTestFinished } from "vitest";
import type { CookoutClient } from "@ai-hero/cookout-client";
import { createCookoutClient } from "@ai-hero/cookout-client";
import type { Identity, StorageAdapter } from "@ai-hero/cookout-protocol";
import { createMemoryStorage } from "@ai-hero/cookout-storage-memory";
import type { FakeClock } from "./fake-clock.ts";
import { createFakeClock } from "./fake-clock.ts";
import type { FakeWebhookReceiver } from "./fake-webhook-receiver.ts";
import { startFakeWebhookReceiver } from "./fake-webhook-receiver.ts";
import { hashToken, randomToken, startServer } from "../src/index.ts";

/** An identity made through the helper, with a client that uses its token. */
export type TestIdentity = {
  identity: Identity;
  token: string;
  client: CookoutClient;
};

export type CreateTestIdentityOptions = { owner?: string; admin?: boolean };

export type TestServer = {
  /** The server's base URL, e.g. `http://127.0.0.1:54321`. */
  url: string;
  /** An SDK client using the admin token from the first boot. */
  client: CookoutClient;
  /** The token of the `admin` identity the server made on first boot. */
  adminToken: string;
  /** An SDK client pointed at the server with any token (or none). */
  clientFor(token: string | undefined): CookoutClient;
  /**
   * Creates an identity and returns a client that uses its token. Without
   * `admin` it goes through the protocol as the first-boot admin. With
   * `admin: true` (no route makes a second admin in v1) it is written into
   * the store, its token hashed by the server's own `hashToken`.
   */
  createIdentity(name: string, options?: CreateTestIdentityOptions): Promise<TestIdentity>;
  /**
   * Starts another server on the same store and clock (like a restart).
   * Its `client` uses the first boot's admin token.
   */
  startSecondServer(): Promise<{ url: string; adminToken: string | undefined; client: CookoutClient }>;
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
 * store, a fake clock and a fake webhook receiver, plus an admin SDK client.
 * Everything is shut down when the current test ends.
 */
export async function startTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const clock = createFakeClock(options.startTime ?? new Date("2026-01-01T00:00:00.000Z"));
  const storage = createMemoryStorage();
  const webhooks = await startFakeWebhookReceiver();

  async function boot(): Promise<{ url: string; adminToken: string | undefined }> {
    const server = await startServer({ storage, clock, newToken: randomToken, port: 0, host: "127.0.0.1" });
    onTestFinished(() => server.close());
    return { url: server.url, adminToken: server.adminToken };
  }

  const first = await boot();
  onTestFinished(() => storage.close());
  const adminToken = first.adminToken;
  if (adminToken === undefined) throw new Error("The first boot on an empty store made no admin token.");
  const url = first.url;
  const clientFor = (token: string | undefined): CookoutClient =>
    createCookoutClient(token === undefined ? { url, env: {} } : { url, token, env: {} });
  const client = clientFor(adminToken);

  return {
    url,
    client,
    adminToken,
    clientFor,
    async createIdentity(name, identityOptions = {}) {
      if (identityOptions.admin === true) {
        const token = randomToken();
        const identity: Identity = { name, admin: true, createdAt: clock.now().toISOString() };
        if (identityOptions.owner !== undefined) identity.owner = identityOptions.owner;
        if ((await storage.createIdentity(identity, hashToken(token))) === "name_taken") {
          throw new Error(`The name ${name} is taken.`);
        }
        return { identity, token, client: clientFor(token) };
      }
      const created = await client.createIdentity(
        identityOptions.owner === undefined ? { name } : { name, owner: identityOptions.owner },
      );
      return { ...created, client: clientFor(created.token) };
    },
    async startSecondServer() {
      const second = await boot();
      return { ...second, client: createCookoutClient({ url: second.url, token: adminToken, env: {} }) };
    },
    clock,
    storage,
    webhooks,
  };
}
