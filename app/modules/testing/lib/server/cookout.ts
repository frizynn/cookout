import { Array as Arr, ConfigProvider, Context, Effect, Exit, Layer, Record as Rec, Ref, Scope } from "effect";
import type { CookoutClient, CookoutClientOptions, Identity, Token } from "../../../sdk/index.ts";
import { backingServices, newToken, storageFor } from "./backing.ts";
import { currentTime, startTestClock } from "./time.ts";
import { Identities } from "../../../identities/server.ts";
import type { IdentityFixtureOptions } from "./identities.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageKind } from "./backing.ts";
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
  readonly clientFor: (token?: string, options?: Pick<CookoutClientOptions, "leaseId">) => CookoutClient;
  readonly createIdentity: (name: string, options?: CreateTestIdentityOptions) => Effect.Effect<TestIdentity>;
  readonly startSecondServer: Effect.Effect<BootedServer>;
  readonly restart: Effect.Effect<CookoutClient>;
  readonly seedCommand: (stored: StoredCommand) => Effect.Effect<void>;
  readonly webhook: WebhookFake["Service"];
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()(
  "@ai-hero/cookout/testing/lib/server/cookout/TestCookout",
) {}

export type TestCookoutOptions = {
  readonly storage?: StorageKind;
  readonly secrets?: "test" | "live";
  readonly leaseSeconds?: number;
  readonly publicUrl?: string;
  readonly webhookTimeoutSeconds?: number;
  readonly requestsPerMinute?: number;
  readonly commandCallsPerMinute?: number;
  readonly streamsPerIdentity?: number;
};

type NumberSetting =
  | "commandCallsPerMinute"
  | "leaseSeconds"
  | "requestsPerMinute"
  | "streamsPerIdentity"
  | "webhookTimeoutSeconds";

const settingNames: readonly (readonly [NumberSetting, string])[] = [
  ["commandCallsPerMinute", "COOKOUT_COMMAND_CALLS_PER_MINUTE"],
  ["leaseSeconds", "COOKOUT_LEASE_SECONDS"],
  ["requestsPerMinute", "COOKOUT_REQUESTS_PER_MINUTE"],
  ["streamsPerIdentity", "COOKOUT_STREAMS_PER_IDENTITY"],
  ["webhookTimeoutSeconds", "COOKOUT_WEBHOOK_TIMEOUT_SECONDS"],
];

function serverEnv(options: TestCookoutOptions): ConfigProvider.ConfigProvider {
  const set = Arr.flatMap(settingNames, ([option, name]) => {
    const value = options[option];
    return value === undefined ? [] : [[name, String(value)] as const];
  });
  return ConfigProvider.fromEnv({ env: Rec.fromEntries(set) });
}

const clientAt =
  (url: string) =>
  (token: string | undefined, options: Pick<CookoutClientOptions, "leaseId"> = {}): CookoutClient =>
    createCookoutClient({ env: {}, url, ...(token === undefined ? {} : { token }), ...options });

const seedIdentity =
  (url: string) =>
  (name: string, options: CreateTestIdentityOptions = {}): Effect.Effect<TestIdentity, never, Storage | Identities> =>
    Effect.gen(function* seedTestIdentity() {
      const storage = yield* Storage;
      const identities = yield* Identities;
      const createdAt = yield* currentTime;
      const identity: Identity = { ...identityFixture(name, options), createdAt };
      const { token, hash } = yield* identities.issueToken;
      yield* storage.createIdentity(identity, hash);
      return { client: clientAt(url)(token), identity, token };
    }).pipe(Effect.orDie);

function seedCommand(stored: StoredCommand): Effect.Effect<void, never, Storage> {
  const handler = {
    admin: false,
    createdAt: stored.command.createdAt,
    kind: "agent",
    name: stored.command.handler,
  } as const;
  return Effect.gen(function* seedTestCommand() {
    const storage = yield* Storage;
    yield* storage.addCommand(stored, handler);
  }).pipe(Effect.orDie);
}

type BootedContext = Context.Context<Storage | Identities | WebhookFake>;

interface Booted {
  readonly url: string;
  readonly server: BootedContext;
}

interface Boot {
  readonly adminToken: Token;
  readonly boot: Effect.Effect<Booted, never, Scope.Scope>;
}

function bootOn(options: TestCookoutOptions): Effect.Effect<Boot, never, Scope.Scope> {
  return Effect.gen(function* prepareBoot() {
    const services = yield* Layer.build(backingServices(options));
    const storage = yield* storageFor(options);
    const adminToken = yield* newToken(services);
    const server = cookoutServer({ adminToken, host: "127.0.0.1", port: 0, publicUrl: options.publicUrl ?? "" });
    const layer = server.pipe(Layer.provideMerge(storage), Layer.provideMerge(Layer.succeedContext(services)));
    const boot = Effect.gen(function* bootServer() {
      const booted = yield* Layer.build(layer);
      const url = yield* serverUrl.pipe(Effect.provideContext(booted));
      return { server: booted, url };
    }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, serverEnv(options)), Effect.orDie);
    return { adminToken, boot };
  });
}

export const testCookout = (options: TestCookoutOptions = {}): Layer.Layer<TestCookout> =>
  Layer.effect(
    TestCookout,
    Effect.gen(function* startTestCookout() {
      yield* startTestClock;
      const scope = yield* Effect.scope;
      const { adminToken, boot } = yield* bootOn(options);
      const firstScope = yield* Scope.fork(scope);
      const serverScope = yield* Ref.make(firstScope);
      const first = yield* Scope.provide(boot, firstScope);
      const restart = Effect.gen(function* restartServer() {
        const stopped = yield* Ref.get(serverScope);
        yield* Scope.close(stopped, Exit.void);
        const next = yield* Scope.fork(scope);
        yield* Ref.set(serverScope, next);
        const { url } = yield* Scope.provide(boot, next);
        return clientAt(url)(adminToken);
      });
      const onFirst = Effect.provideContext(first.server);
      return TestCookout.of({
        adminToken,
        client: clientAt(first.url)(adminToken),
        clientFor: clientAt(first.url),
        createIdentity: (name, identityOptions = {}) => onFirst(seedIdentity(first.url)(name, identityOptions)),
        restart,
        seedCommand: (stored) => onFirst(seedCommand(stored)),
        startSecondServer: Effect.map(Scope.provide(boot, scope), ({ url }) => ({ url })),
        url: first.url,
        webhook: Context.get(first.server, WebhookFake),
      });
    }).pipe(Effect.orDie),
  );
