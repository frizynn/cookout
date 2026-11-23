import { ConfigProvider, Context, Effect, Layer } from "effect";
import type { CookoutClient, CookoutClientOptions, Identity, Token } from "../../../sdk/index.ts";
import { FirstBoot, Identities } from "../../../identities/server.ts";
import { Storage, memoryStorage } from "../../../storage/server.ts";
import { currentTime, startTestClock } from "./time.ts";
import type { IdentityFixtureOptions } from "./identities.ts";
import type { StoredCommand } from "../../../storage/server.ts";
import { cookoutServer } from "../../../cli/server.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { identityFixture } from "./identities.ts";
import { secretsOf } from "./secrets.ts";
import { serverUrl } from "../../../http/server.ts";
import { unusableStorage } from "./storage.ts";

export type TestIdentity = {
  readonly identity: Identity;
  readonly token: Token;
  readonly client: CookoutClient;
};

export type CreateTestIdentityOptions = IdentityFixtureOptions;

export type BootedServer = {
  readonly url: string;
  readonly adminToken: Token | undefined;
};

export type TestCookoutService = {
  readonly url: string;
  readonly adminToken: Token;
  readonly client: CookoutClient;
  readonly clientFor: (token: string | undefined, options?: Pick<CookoutClientOptions, "leaseId">) => CookoutClient;
  readonly createIdentity: (name: string, options?: CreateTestIdentityOptions) => Effect.Effect<TestIdentity>;
  readonly startSecondServer: Effect.Effect<BootedServer>;
  readonly seedCommand: (stored: StoredCommand) => Effect.Effect<void>;
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()("cookout/testing/TestCookout") {}

export type TestCookoutOptions = {
  readonly storage?: "memory" | "unusable";
  readonly secrets?: "test" | "live";
  readonly leaseSeconds?: number;
  readonly publicUrl?: string;
};

const storageFor = (options: TestCookoutOptions) => (options.storage === "unusable" ? unusableStorage : memoryStorage);

const secretsFor = (options: TestCookoutOptions) => secretsOf(options.secrets ?? "test");

function serverEnv({ leaseSeconds }: TestCookoutOptions): ConfigProvider.ConfigProvider {
  if (typeof leaseSeconds === "number") {
    return ConfigProvider.fromEnv({ env: { COOKOUT_LEASE_SECONDS: String(leaseSeconds) } });
  }
  return ConfigProvider.fromEnv({ env: {} });
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
      const store = yield* Layer.build(Layer.mergeAll(storageFor(options), secretsFor(options)));
      const config = serverEnv(options);
      const boot = Effect.gen(function* () {
        const server = yield* Layer.buildWithScope(
          cookoutServer({ host: "127.0.0.1", port: 0, publicUrl: options.publicUrl ?? "" }).pipe(
            Layer.provide(Layer.succeedContext(store)),
          ),
          scope,
        );
        const url = yield* serverUrl.pipe(Effect.provideContext(server));
        return { adminToken: Context.get(server, FirstBoot).adminToken, server, url };
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, config));
      const first = yield* boot;
      const firstAdminToken = yield* Effect.fromNullishOr(first.adminToken);
      const clientFor = clientAt(first.url);
      return {
        adminToken: firstAdminToken,
        client: clientFor(firstAdminToken),
        clientFor,
        createIdentity: seedIdentity(Context.get(store, Storage), Context.get(first.server, Identities), first.url),
        seedCommand: seedCommand(Context.get(store, Storage)),
        startSecondServer: Effect.map(boot, ({ url, adminToken }) => ({ adminToken, url })).pipe(Effect.orDie),
        url: first.url,
      };
    }).pipe(Effect.orDie),
  );
