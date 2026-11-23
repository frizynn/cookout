import { ConfigProvider, Context, Effect, Layer } from "effect";
import type { CookoutClient, CookoutClientOptions, Identity, Token } from "../../../sdk/index.ts";
import { backingServices, newToken } from "./backing.ts";
import { currentTime, startTestClock } from "./time.ts";
import { Identities } from "../../../identities/server.ts";
import type { IdentityFixtureOptions } from "./identities.ts";
import { Storage } from "../../../storage/server.ts";
import type { StoredCommand } from "../../../storage/server.ts";
import { WebhookFake } from "../../../webhook-fake/server.ts";
import { cookoutServer } from "../../../cli/server.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { identityFixture } from "./identities.ts";
import { serverUrl } from "../../../http/server.ts";

export type TestIdentity = {
  readonly identity: Identity;
  readonly token: Token;
  readonly client: CookoutClient;
};

export type CreateTestIdentityOptions = IdentityFixtureOptions;

export type BootedServer = {
  readonly url: string;
};

export type TestCookoutService = {
  readonly url: string;
  readonly adminToken: Token;
  readonly client: CookoutClient;
  readonly clientFor: (token: string | undefined, options?: Pick<CookoutClientOptions, "leaseId">) => CookoutClient;
  readonly createIdentity: (name: string, options?: CreateTestIdentityOptions) => Effect.Effect<TestIdentity>;
  readonly startSecondServer: Effect.Effect<BootedServer>;
  readonly seedCommand: (stored: StoredCommand) => Effect.Effect<void>;
  readonly webhook: WebhookFake["Service"];
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()(
  "@ai-hero/cookout/testing/lib/server/cookout/TestCookout",
) {}

export type TestCookoutOptions = {
  readonly storage?: "memory" | "unusable";
  readonly secrets?: "test" | "live";
  readonly leaseSeconds?: number;
  readonly publicUrl?: string;
  readonly webhookTimeoutSeconds?: number;
};

function serverEnv({ leaseSeconds, webhookTimeoutSeconds }: TestCookoutOptions): ConfigProvider.ConfigProvider {
  return ConfigProvider.fromEnv({
    env: {
      ...(leaseSeconds === undefined ? {} : { COOKOUT_LEASE_SECONDS: String(leaseSeconds) }),
      ...(webhookTimeoutSeconds === undefined
        ? {}
        : { COOKOUT_WEBHOOK_TIMEOUT_SECONDS: String(webhookTimeoutSeconds) }),
    },
  });
}

const clientAt =
  (url: string) =>
  (token: string | undefined, options: Pick<CookoutClientOptions, "leaseId"> = {}): CookoutClient =>
    createCookoutClient({ env: {}, url, ...(token === undefined ? {} : { token }), ...options });

const seedIdentity =
  (storage: Storage["Service"], identities: Identities["Service"], url: string) =>
  (name: string, options: CreateTestIdentityOptions = {}): Effect.Effect<TestIdentity> =>
    Effect.gen(function* () {
      const identity: Identity = { ...identityFixture(name, options), createdAt: yield* currentTime };
      const { token, hash } = yield* identities.issueToken;
      yield* storage.createIdentity(identity, hash);
      return { client: clientAt(url)(token), identity, token };
    }).pipe(Effect.orDie);

const seedCommand =
  (storage: Storage["Service"]) =>
  (stored: StoredCommand): Effect.Effect<void> =>
    Effect.asVoid(
      storage.addCommand(stored, {
        admin: false,
        createdAt: stored.command.createdAt,
        kind: "agent",
        name: stored.command.handler,
      }),
    ).pipe(Effect.orDie);

export const testCookout = (options: TestCookoutOptions = {}): Layer.Layer<TestCookout> =>
  Layer.effect(
    TestCookout,
    Effect.gen(function* () {
      yield* startTestClock;
      const scope = yield* Effect.scope;
      const store = yield* Layer.build(backingServices(options));
      const config = serverEnv(options);
      const adminToken = yield* newToken(store);
      const boot = (bootToken: Token) =>
        Effect.gen(function* () {
          const server = yield* Layer.buildWithScope(
            cookoutServer({
              adminToken: bootToken,
              host: "127.0.0.1",
              port: 0,
              publicUrl: options.publicUrl ?? "",
            }).pipe(Layer.provide(Layer.succeedContext(store))),
            scope,
          );
          const url = yield* serverUrl.pipe(Effect.provideContext(server));
          return { server, url };
        }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, config));
      const first = yield* boot(adminToken);
      const clientFor = clientAt(first.url);
      return {
        adminToken,
        client: clientFor(adminToken),
        clientFor,
        createIdentity: seedIdentity(Context.get(store, Storage), Context.get(first.server, Identities), first.url),
        seedCommand: seedCommand(Context.get(store, Storage)),
        startSecondServer: Effect.map(boot(adminToken), ({ url }) => ({ url })).pipe(Effect.orDie),
        url: first.url,
        webhook: Context.get(store, WebhookFake),
      };
    }).pipe(Effect.orDie),
  );
