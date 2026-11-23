import { Array as Arr, Effect, FileSystem, Path } from "effect";
import type { TestCookoutService, TestIdentity } from "./cookout.ts";
import type { CookoutClient } from "../../../sdk/index.ts";
import type { Scope } from "effect";

interface TwoSessions {
  readonly agent: TestIdentity;
  readonly first: CookoutClient;
  readonly second: CookoutClient;
}

interface AgentSessionStateText {
  readonly folder: string;
  readonly text: string;
}

type Files = FileSystem.FileSystem | Path.Path;

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function twoSessions(cookout: TestCookoutService): Effect.Effect<TwoSessions> {
  return Effect.gen(function* identityWithTwoSessions() {
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* Effect.promise(() => agent.client.createChannel({ name: "grill" }));
    return { agent, first: cookout.clientFor(agent.token), second: cookout.clientFor(agent.token) };
  });
}

const freshStateFolder: Effect.Effect<string, never, FileSystem.FileSystem | Scope.Scope> = Effect.gen(
  function* makeStateFolder() {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.makeTempDirectoryScoped({ prefix: "cookout-state-" });
  },
).pipe(Effect.orDie);

function agentSessionStateFiles(stateFolder: string): Effect.Effect<readonly string[], never, Files> {
  return Effect.gen(function* listAgentSessionStates() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = path.join(stateFolder, "agent-sessions");
    const names = yield* fs.readDirectory(folder);
    return Arr.map(names, (name) => path.join(folder, name));
  }).pipe(Effect.orDie);
}

function writeAgentSessionStates({ folder, text }: AgentSessionStateText): Effect.Effect<void, never, Files> {
  return Effect.gen(function* overwriteAgentSessionStates() {
    const fs = yield* FileSystem.FileSystem;
    const files = yield* agentSessionStateFiles(folder);
    yield* Effect.forEach(files, (file) => fs.writeFileString(file, text), ONE_AT_A_TIME);
  }).pipe(Effect.orDie);
}

export { type TwoSessions, freshStateFolder, agentSessionStateFiles, twoSessions, writeAgentSessionStates };
