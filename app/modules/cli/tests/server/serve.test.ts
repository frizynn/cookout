import { Array as Arr, Effect, FileSystem, Path, Schema, String as Str } from "effect";
import {
  answer,
  commandLineServices,
  freshDatabasePath,
  refusal,
  runCookout,
  startServe,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import { createCookoutClient } from "../../../sdk/index.ts";
import { secretsLive } from "../../../secrets/server.ts";

interface StoredFiles {
  readonly files: readonly string[];
  readonly text: string;
}

const ISSUED = 3;
const UNAUTHORIZED = 401;
const NEW_ADMIN_TOKEN = "new-admin-token-0123456789abcdef0123456789";
const SHORT_ADMIN_TOKEN = "hunter2-but-longer";
const EXIT_FAILURE = 1;
const mentionsAToken = Schema.is(Schema.Struct({ adminToken: Schema.Unknown }));

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

function issueTokens(url: string, adminToken: string): Effect.Effect<readonly string[]> {
  return Effect.gen(function* createAndRotate() {
    const admin = createCookoutClient({ env: {}, token: adminToken, url });
    const created = yield* answer(() => admin.createIdentity({ kind: "agent", name: "agent" }));
    const rotated = yield* answer(() => admin.rotateToken("agent"));
    return [adminToken, created.token, rotated.token];
  });
}

it.effect("a fresh board's admin works with COOKOUT_ADMIN_TOKEN, and serve prints nothing about it", () =>
  Effect.gen(function* adminTokenFromSetting() {
    const database = yield* freshDatabasePath;
    const server = yield* startServe({ database });
    const whoami = yield* answer(createCookoutClient({ env: {}, token: server.adminToken, url: server.url }).whoami);

    expect(whoami.identity).toMatchObject({ admin: true, name: "admin" });
    expect(server.stdout).not.toContain(server.adminToken);
    expect(Arr.filter(server.lines, mentionsAToken)).toStrictEqual([]);
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);

it.effect("restarting a board with a different COOKOUT_ADMIN_TOKEN makes the new one work and the old one fail", () =>
  Effect.gen(function* restartWithNewAdminToken() {
    const database = yield* freshDatabasePath;
    const first = yield* startServe({ database });
    yield* first.stop;
    const second = yield* startServe({ adminToken: NEW_ADMIN_TOKEN, database });
    const whoami = yield* answer(createCookoutClient({ env: {}, token: NEW_ADMIN_TOKEN, url: second.url }).whoami);
    const old = yield* refusal(createCookoutClient({ env: {}, token: first.adminToken, url: second.url }).whoami);

    expect(whoami.identity).toMatchObject({ admin: true, name: "admin" });
    expect(old).toMatchObject({ status: UNAUTHORIZED });
    expect(second.stdout).not.toContain(NEW_ADMIN_TOKEN);
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);

it.effect("the database never holds a token itself", () =>
  Effect.gen(function* noTokensOnDisk() {
    const database = yield* freshDatabasePath;
    const server = yield* startServe({ database });
    const tokens = yield* issueTokens(server.url, server.adminToken);
    yield* server.stop;
    const { files, text } = yield* filesNextTo(database);
    const onDisk = Arr.filter(tokens, (token) => Str.includes(token)(text));

    expect(files).toContain("cookout.db");
    expect(tokens).toHaveLength(ISSUED);
    expect(onDisk).toStrictEqual([]);
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);

it.effect("cookout serve refuses to start without COOKOUT_ADMIN_TOKEN and says how to set it", () =>
  Effect.gen(function* refusesWithoutAdminToken() {
    const refused = yield* runCookout({ args: ["serve", "--port", "0", "--host", "127.0.0.1"], env: {} });

    expect(refused).toMatchObject({ exitCode: EXIT_FAILURE, stdout: "" });
    expect(refused.stderr).toContain("COOKOUT_ADMIN_TOKEN must be set");
    expect(refused.stderr).toContain("openssl rand -hex 32");
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("cookout serve refuses a COOKOUT_ADMIN_TOKEN too short to be a token without showing it", () =>
  Effect.gen(function* refusesShortAdminToken() {
    const refused = yield* runCookout({
      args: ["serve", "--port", "0", "--host", "127.0.0.1"],
      env: { COOKOUT_ADMIN_TOKEN: SHORT_ADMIN_TOKEN },
    });

    expect(refused).toMatchObject({ exitCode: EXIT_FAILURE, stdout: "" });
    expect(refused.stderr).toContain("at least 32 characters");
    expect(refused.stderr).not.toContain(SHORT_ADMIN_TOKEN);
  }).pipe(Effect.provide(commandLineServices)),
);
