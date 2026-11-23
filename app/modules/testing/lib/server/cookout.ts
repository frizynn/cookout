import {
  Array as Arr,
  ConfigProvider,
  Context,
  Effect,
  Exit,
  Layer,
  Option,
  Predicate,
  Record as Rec,
  Ref,
  Scope,
} from "effect";
import type { Booted, LastEnd } from "./booted.ts";
import type { CookoutClient, Identity, Token } from "../../../sdk/index.ts";
import type { StorageUnavailable, StoredCommand, StoredDelivery } from "../../../storage/server.ts";
import { backingServices, newToken, storageFor } from "./backing.ts";
import { booted, lastEndOn, liveConnectionsClosedOn } from "./booted.ts";
import { currentTime, startTestClock } from "./time.ts";
import { identityFixture, identityName, ownedByAdminUnlessNamed, testCookoutAdminName } from "./identities.ts";
import type { AdminNameIsAgent } from "../../../identities/server.ts";
import { Identities } from "../../../identities/server.ts";
import type { IdentityFixtureOptions } from "./identities.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageKind } from "./backing.ts";
import { WebhookFake } from "../../../webhook-fake/server.ts";
import { cookoutServer } from "../../../cli/server.ts";
import { createCookoutClient } from "../../../sdk/index.ts";

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
  readonly clientFor: (token?: string) => CookoutClient;
  readonly createIdentity: (name: string, options?: CreateTestIdentityOptions) => Effect.Effect<TestIdentity>;
  readonly startSecondServer: Effect.Effect<BootedServer>;
  readonly startSecondServerAs: (adminName: string) => Effect.Effect<BootedServer, AdminNameIsAgent>;
  readonly restart: Effect.Effect<CookoutClient>;

  readonly liveConnectionsClosed: (name: string) => Effect.Effect<void>;
  readonly lastEnd: (name: string) => Effect.Effect<LastEnd>;
  readonly restartServer: Effect.Effect<BootedServer>;
  readonly seedCommand: (stored: StoredCommand) => Effect.Effect<void>;
  readonly pendingDeliveries: Effect.Effect<readonly StoredDelivery[]>;
  readonly webhook: WebhookFake["Service"];
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()(
  "@ai-hero/cookout/testing/lib/server/cookout/TestCookout",
) {}

export type TestCookoutOptions = {
  readonly storage?: StorageKind;
  readonly secrets?: "test" | "live";
  readonly maxIdleExpiry?: string;
  readonly publicUrl?: string;
  readonly adminName?: string;
  readonly webhookTimeoutSeconds?: number;
  readonly requestsPerMinute?: number;
  readonly commandCallsPerMinute?: number;
  readonly streamsPerIdentity?: number;
  readonly routine?: "fake" | "unreachable";
};

type Setting =
  | "commandCallsPerMinute"
  | "maxIdleExpiry"
  | "requestsPerMinute"
  | "streamsPerIdentity"
  | "webhookTimeoutSeconds";

const settingNames: readonly (readonly [Setting, string])[] = [
  ["commandCallsPerMinute", "COOKOUT_COMMAND_CALLS_PER_MINUTE"],
  ["maxIdleExpiry", "COOKOUT_MAX_IDLE_EXPIRY"],
  ["requestsPerMinute", "COOKOUT_REQUESTS_PER_MINUTE"],
  ["streamsPerIdentity", "COOKOUT_STREAMS_PER_IDENTITY"],
  ["webhookTimeoutSeconds", "COOKOUT_WEBHOOK_TIMEOUT_SECONDS"],
];

const testRoutineFirePath = "/v1/claude_code/routines/trig_test/fire";

const testRoutineToken = "routine-test-token";

const unreachableUrl = "http://127.0.0.1:1";

function routineBase(routine: "fake" | "unreachable", webhookUrl: string): string {
  if (routine === "fake") {
    return webhookUrl;
  }
  return unreachableUrl;
}

function routineEnv(options: TestCookoutOptions, webhookUrl: string): readonly (readonly [string, string])[] {
  if (Predicate.isUndefined(options.routine)) {
    return [];
  }
  return [
    ["COOKOUT_ROUTINE_FIRE_URL", `${routineBase(options.routine, webhookUrl)}${testRoutineFirePath}`],
    ["COOKOUT_ROUTINE_TOKEN", testRoutineToken],
  ];
}

function serverEnv(options: TestCookoutOptions, webhookUrl: string): ConfigProvider.ConfigProvider {
  const set = Arr.flatMap(settingNames, ([option, name]) => {
    const value = options[option];
    return value === undefined ? [] : [[name, String(value)] as const];
  });
  return ConfigProvider.fromEnv({ env: Rec.fromEntries([...set, ...routineEnv(options, webhookUrl)]) });
}

const clientAt =
  (url: string) =>
  (token: string | undefined): CookoutClient =>
    createCookoutClient({ env: {}, url, ...(token === undefined ? {} : { token }) });

function seedMissingOwner(identity: Identity): Effect.Effect<void, StorageUnavailable, Storage | Identities> {
  return Effect.gen(function* seedOwner() {
    if (identity.kind === "human") {
      return;
    }
    const storage = yield* Storage;
    const found = yield* storage.findIdentityByName(identity.owner);
    if (Predicate.isNotUndefined(found)) {
      return;
    }
    const { hash } = yield* Effect.flatMap(Identities, (identities) => identities.issueToken);
    const owner = identityFixture(identity.owner, { kind: "human" });
    yield* storage.createIdentity({ ...owner, createdAt: identity.createdAt }, hash);
  });
}

const seedIdentity =
  (url: string) =>
  (name: string, options: CreateTestIdentityOptions = {}): Effect.Effect<TestIdentity, never, Storage | Identities> =>
    Effect.gen(function* seedTestIdentity() {
      const storage = yield* Storage;
      const identities = yield* Identities;
      const createdAt = yield* currentTime;
      const identity: Identity = { ...identityFixture(name, ownedByAdminUnlessNamed(options)), createdAt };
      yield* seedMissingOwner(identity);
      const { token, hash } = yield* identities.issueToken;
      const created = yield* storage.createIdentity(identity, hash);
      yield* Effect.orDie(Effect.fromOption(Option.liftPredicate(created, (result) => result === "created")));
      return { client: clientAt(url)(token), identity, token };
    }).pipe(Effect.orDie);

function seedCommand(stored: StoredCommand): Effect.Effect<void, never, Storage> {
  const handler = {
    admin: false,
    createdAt: stored.command.createdAt,
    kind: "agent",
    name: stored.command.handler,
    owner: testCookoutAdminName,
  } as const;
  return Effect.gen(function* seedTestCommand() {
    const storage = yield* Storage;
    yield* storage.addCommand(stored, handler);
  }).pipe(Effect.orDie);
}

const pendingDeliveries: Effect.Effect<readonly StoredDelivery[], never, Storage> = Effect.gen(
  function* listTestPendingDeliveries() {
    const storage = yield* Storage;
    return yield* storage.listPendingDeliveries;
  },
).pipe(Effect.orDie);

interface Boot {
  readonly adminToken: Token;
  readonly boot: Effect.Effect<Booted, never, Scope.Scope>;
  readonly bootAs: (adminName: string | undefined) => Effect.Effect<Booted, AdminNameIsAgent, Scope.Scope>;
}

function bootOn(options: TestCookoutOptions): Effect.Effect<Boot, never, Scope.Scope> {
  return Effect.gen(function* prepareBoot() {
    const services = yield* Layer.build(backingServices(options));
    const storage = yield* storageFor(options);
    const adminToken = yield* newToken(services);
    const env = serverEnv(options, Context.get(services, WebhookFake).url);
    const bootAs = (adminName: string | undefined) =>
      Effect.gen(function* bootServer() {
        const named = adminName === undefined ? {} : { adminName: identityName(adminName) };
        const server = cookoutServer({
          adminToken,
          host: "127.0.0.1",
          port: 0,
          publicUrl: options.publicUrl ?? "",
          ...named,
        });
        return yield* booted(
          server.pipe(Layer.provideMerge(storage), Layer.provideMerge(Layer.succeedContext(services))),
        );
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, env),
        Effect.catchTags({ ConfigError: Effect.die, ServeError: Effect.die, StorageUnavailable: Effect.die }),
      );
    return { adminToken, boot: Effect.orDie(bootAs(options.adminName)), bootAs };
  });
}

export const testCookout = (options: TestCookoutOptions = {}): Layer.Layer<TestCookout> =>
  Layer.effect(
    TestCookout,
    Effect.gen(function* startTestCookout() {
      yield* startTestClock;
      const scope = yield* Effect.scope;
      const { adminToken, boot, bootAs } = yield* bootOn(options);
      const firstScope = yield* Scope.fork(scope);
      const serverScope = yield* Ref.make(firstScope);
      const first = yield* Scope.provide(boot, firstScope);
      const running = yield* Ref.make(first.server);
      const restartServer = Effect.gen(function* restartServer() {
        const stopped = yield* Ref.get(serverScope);
        yield* Scope.close(stopped, Exit.void);
        const next = yield* Scope.fork(scope);
        yield* Ref.set(serverScope, next);
        const { server, url } = yield* Scope.provide(boot, next);
        yield* Ref.set(running, server);
        return { url };
      });
      const onFirst = Effect.provideContext(first.server);
      return TestCookout.of({
        adminToken,
        client: clientAt(first.url)(adminToken),
        clientFor: clientAt(first.url),
        createIdentity: (name, identityOptions = {}) => onFirst(seedIdentity(first.url)(name, identityOptions)),
        lastEnd: (name) => Effect.flatMap(Ref.get(running), (server) => lastEndOn({ name, server })),
        liveConnectionsClosed: (name) =>
          Effect.flatMap(Ref.get(running), (server) => liveConnectionsClosedOn({ name, server })),
        pendingDeliveries: onFirst(pendingDeliveries),
        restart: Effect.map(restartServer, ({ url }) => clientAt(url)(adminToken)),
        restartServer,
        seedCommand: (stored) => onFirst(seedCommand(stored)),
        startSecondServer: Effect.map(Scope.provide(boot, scope), ({ url }) => ({ url })),
        startSecondServerAs: (adminName) => Effect.map(Scope.provide(bootAs(adminName), scope), ({ url }) => ({ url })),
        url: first.url,
        webhook: Context.get(first.server, WebhookFake),
      });
    }).pipe(Effect.orDie),
  );

export { testRoutineFirePath, testRoutineToken };
