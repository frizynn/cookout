import { Context, DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { cookoutServer } from "../../../cli/server.ts";
import { serverUrl } from "../../../http/server.ts";
import type { Identity, Token } from "../../../identities/index.ts";
import { isIdentityName, isOwner } from "../../../identities/index.ts";
import { FirstBoot, Identities } from "../../../identities/server.ts";
import { type CookoutClient, createCookoutClient } from "../../../sdk/index.ts";
import { secretsLive, secretsTest } from "../../../secrets/server.ts";
import { memoryStorage, Storage } from "../../../storage/server.ts";
import { unusableStorage } from "./storage.ts";

export const testStartTime = "2026-01-01T00:00:00.000Z";

export type TestIdentity = {
  readonly identity: Identity;
  readonly token: Token;
  readonly client: CookoutClient;
};

export type CreateTestIdentityOptions = { readonly owner?: string; readonly admin?: boolean };

export type BootedServer = {
  readonly url: string;
  readonly adminToken: Token | undefined;
};

export type TestCookoutService = {
  readonly url: string;
  readonly adminToken: Token;
  readonly client: CookoutClient;
  readonly clientFor: (token: string | undefined) => CookoutClient;
  readonly createIdentity: (name: string, options?: CreateTestIdentityOptions) => Effect.Effect<TestIdentity>;
  readonly startSecondServer: Effect.Effect<BootedServer>;
};

export class TestCookout extends Context.Service<TestCookout, TestCookoutService>()("cookout/testing/TestCookout") {}

export type TestCookoutOptions = {
  readonly storage?: "memory" | "unusable";
  readonly secrets?: "test" | "live";
};

const storageFor = (options: TestCookoutOptions) => (options.storage === "unusable" ? unusableStorage : memoryStorage);

const secretsFor = (options: TestCookoutOptions) => (options.secrets === "live" ? secretsLive : secretsTest);

const clientAt =
  (url: string) =>
  (token: string | undefined): CookoutClient =>
    createCookoutClient({ url, env: {}, ...(token === undefined ? {} : { token }) });

const brokenRule = (what: string) => Effect.die(new Error(`${what} breaks the identity rules.`));

const identityFields = (name: string, owner: string | undefined) => {
  if (!isIdentityName(name)) return brokenRule(`The name ${name}`);
  if (owner === undefined) return Effect.succeed({ name });
  return isOwner(owner) ? Effect.succeed({ name, owner }) : brokenRule(`The owner ${owner}`);
};

const seedIdentity =
  (storage: Storage["Service"], identities: Identities["Service"], url: string) =>
  (name: string, options: CreateTestIdentityOptions = {}): Effect.Effect<TestIdentity> =>
    Effect.gen(function* () {
      const identity: Identity = {
        ...(yield* identityFields(name, options.owner)),
        admin: options.admin === true,
        createdAt: DateTime.formatIso(yield* DateTime.now),
      };
      const { token, hash } = yield* identities.issueToken;
      if ((yield* storage.createIdentity(identity, hash)) === "name_taken") {
        return yield* Effect.die(new Error(`The name ${name} is taken.`));
      }
      return { identity, token, client: clientAt(url)(token) };
    }).pipe(Effect.orDie);

export const testCookout = (options: TestCookoutOptions = {}): Layer.Layer<TestCookout> =>
  Layer.effect(
    TestCookout,
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(testStartTime)));
      const scope = yield* Effect.scope;
      const store = yield* Layer.build(Layer.mergeAll(storageFor(options), secretsFor(options)));
      const boot = Effect.gen(function* () {
        const server = yield* Layer.buildWithScope(
          cookoutServer({ port: 0, host: "127.0.0.1" }).pipe(Layer.provide(Layer.succeedContext(store))),
          scope,
        );
        const url = yield* serverUrl.pipe(Effect.provideContext(server));
        return { url, adminToken: Context.get(server, FirstBoot).adminToken, server };
      });
      const first = yield* boot;
      if (first.adminToken === undefined) return yield* Effect.die(new Error("The first boot made no admin token."));
      const clientFor = clientAt(first.url);
      return {
        url: first.url,
        adminToken: first.adminToken,
        client: clientFor(first.adminToken),
        clientFor,
        createIdentity: seedIdentity(Context.get(store, Storage), Context.get(first.server, Identities), first.url),
        startSecondServer: Effect.map(boot, ({ url, adminToken }) => ({ url, adminToken })).pipe(Effect.orDie),
      };
    }).pipe(Effect.orDie),
  );
