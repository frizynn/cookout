import { Array as Arr, Context, Effect, FileSystem, Layer, Path } from "effect";
import type { TestCookoutService, TestIdentity } from "./cookout.ts";
import type { CookoutClient } from "../../../sdk/index.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";

interface TwoSessions {
  readonly agent: TestIdentity;
  readonly first: CookoutClient;
  readonly second: CookoutClient;
}

function twoSessions(cookout: TestCookoutService): Effect.Effect<TwoSessions> {
  return Effect.gen(function* identityWithTwoSessions() {
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* Effect.promise(() => agent.client.createChannel({ name: "grill" }));
    return { agent, first: cookout.clientFor(agent.token), second: cookout.clientFor(agent.token) };
  });
}

const freshStateFolder: Effect.Effect<string, never, Scope.Scope> = Effect.gen(function* makeStateFolder() {
  const node = yield* Layer.build(NodeServices.layer);
  const fs = Context.get(node, FileSystem.FileSystem);
  return yield* fs.makeTempDirectoryScoped({ prefix: "cookout-state-" });
}).pipe(Effect.orDie);

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function leaseStateFiles(stateFolder: string): Effect.Effect<readonly string[]> {
  return Effect.gen(function* listLeaseStates() {
    const node = yield* Layer.build(NodeServices.layer);
    const fs = Context.get(node, FileSystem.FileSystem);
    const path = Context.get(node, Path.Path);
    const folder = path.join(stateFolder, "leases");
    const names = yield* fs.readDirectory(folder);
    return Arr.map(names, (name) => path.join(folder, name));
  }).pipe(Effect.scoped, Effect.orDie);
}

function damageLeaseStates(stateFolder: string): Effect.Effect<void> {
  return Effect.gen(function* overwriteLeaseStates() {
    const node = yield* Layer.build(NodeServices.layer);
    const fs = Context.get(node, FileSystem.FileSystem);
    const files = yield* leaseStateFiles(stateFolder);
    yield* Effect.forEach(files, (file) => fs.writeFileString(file, "{"), ONE_AT_A_TIME);
  }).pipe(Effect.scoped, Effect.orDie);
}

export { type TwoSessions, damageLeaseStates, freshStateFolder, leaseStateFiles, twoSessions };
