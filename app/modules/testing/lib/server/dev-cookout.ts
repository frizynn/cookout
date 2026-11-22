import { Context, Effect, FileSystem, Layer, Path } from "effect";
import { WebhookFake, webhookFake } from "../../../webhook-fake/server.ts";
import { FirstBoot } from "../../../identities/server.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import { cookoutServer } from "../../../cli/server.ts";
import { secretsLive } from "../../../secrets/server.ts";
import { serverUrl } from "../../../http/server.ts";
import { sqliteStorage } from "../../../storage/server.ts";

interface DevCookout {
  readonly adminToken: string;
  readonly database: string;
  readonly url: string;
  readonly webhookFakeUrl: string;
}

const LOCAL = "127.0.0.1";

function databaseInTempFolder(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeDatabasePath() {
    const node = yield* Layer.build(NodeServices.layer);
    const fs = Context.get(node, FileSystem.FileSystem);
    const folder = yield* Effect.orDie(fs.makeTempDirectoryScoped({ prefix: "cookout-dev-" }));
    return Context.get(node, Path.Path).join(folder, "cookout.db");
  });
}

function devCookout(port: number): Effect.Effect<DevCookout, never, Scope.Scope> {
  return Effect.gen(function* startDevCookout() {
    const database = yield* databaseInTempFolder();
    const live = Layer.mergeAll(sqliteStorage(database), secretsLive);
    const server = yield* Layer.build(cookoutServer({ host: LOCAL, port }).pipe(Layer.provide(live)));
    const fake = yield* Layer.build(webhookFake);
    const url = yield* Effect.provideContext(serverUrl, server);
    const { adminToken = "" } = Context.get(server, FirstBoot);
    return { adminToken, database, url, webhookFakeUrl: Context.get(fake, WebhookFake).url };
  }).pipe(Effect.orDie);
}

export { devCookout };
