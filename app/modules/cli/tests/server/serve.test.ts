import { Array as Arr, Effect, FileSystem, Path, Schema, String as Str, pipe } from "effect";
import { answer, freshDatabasePath, startServe } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import { createCookoutClient } from "../../../sdk/index.ts";

interface StoredFiles {
  readonly files: readonly string[];
  readonly text: string;
}

const ISSUED = 3;
const isAdminTokenLine = Schema.is(Schema.Struct({ adminToken: Schema.String, identity: Schema.Literal("admin") }));

function adminTokensIn(lines: readonly unknown[]): readonly string[] {
  return pipe(
    lines,
    Arr.filter(isAdminTokenLine),
    Arr.map(({ adminToken }) => adminToken),
  );
}

function filesNextTo(database: string): Effect.Effect<StoredFiles, never, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* readStoredFiles() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = path.dirname(database);
    const files = yield* fs.readDirectory(folder);
    const contents = yield* Effect.forEach(files, (file) => fs.readFileString(path.join(folder, file), "latin1"), {
      concurrency: 1,
    });
    return { files, text: Arr.join(contents, "\n") };
  }).pipe(Effect.orDie);
}

function issueTokens(url: string, adminTokens: readonly string[]): Effect.Effect<readonly string[]> {
  return Effect.gen(function* createAndRotate() {
    const [adminToken = "none"] = adminTokens;
    const admin = createCookoutClient({ env: {}, token: adminToken, url });
    const created = yield* answer(() => admin.createIdentity({ name: "agent", owner: "matt" }));
    const rotated = yield* answer(() => admin.rotateToken("agent"));
    return [adminToken, created.token, rotated.token];
  });
}

it.effect("cookout serve prints the admin token on the first boot only", () =>
  Effect.gen(function* firstBootToken() {
    const database = yield* freshDatabasePath;
    const first = yield* startServe(database);
    yield* first.stop;
    const second = yield* startServe(database);
    const [adminToken = "none"] = adminTokensIn(first.lines);
    const whoami = yield* answer(createCookoutClient({ env: {}, token: adminToken, url: second.url }).whoami);

    expect(adminTokensIn(first.lines)).toStrictEqual([adminToken]);
    expect(adminTokensIn(second.lines)).toStrictEqual([]);
    expect(second.stdout).not.toContain(adminToken);
    expect(whoami.identity).toMatchObject({ admin: true, name: "admin" });
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("the database never holds a token itself", () =>
  Effect.gen(function* noTokensOnDisk() {
    const database = yield* freshDatabasePath;
    const server = yield* startServe(database);
    const tokens = yield* issueTokens(server.url, adminTokensIn(server.lines));
    yield* server.stop;
    const { files, text } = yield* filesNextTo(database);
    const onDisk = Arr.filter(tokens, (token) => Str.includes(token)(text));

    expect(files).toContain("cookout.db");
    expect(tokens).toHaveLength(ISSUED);
    expect(onDisk).toStrictEqual([]);
  }).pipe(Effect.provide(NodeServices.layer)),
);
