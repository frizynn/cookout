import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { createCookoutClient } from "../../sdk/index.ts";
import { freshDatabasePath, startServe } from "../../testing/server.ts";

const isAdminTokenLine = Schema.is(Schema.Struct({ adminToken: Schema.String, identity: Schema.Literal("admin") }));

const adminTokensIn = (lines: ReadonlyArray<unknown>) => lines.filter(isAdminTokenLine).map((line) => line.adminToken);

it.effect("cookout serve prints the admin token on the first boot only", () =>
  Effect.gen(function* () {
    const database = yield* freshDatabasePath;

    const first = yield* startServe(database);
    const [adminToken, ...more] = adminTokensIn(first.lines);
    expect(more).toEqual([]);
    if (adminToken === undefined) return expect.unreachable("The first boot printed no admin token.");
    yield* first.stop;

    const second = yield* startServe(database);
    expect(adminTokensIn(second.lines)).toEqual([]);
    expect(JSON.stringify(second.lines)).not.toContain(adminToken);

    const admin = createCookoutClient({ url: second.url, token: adminToken, env: {} });
    expect((yield* Effect.promise(() => admin.whoami())).identity).toMatchObject({ name: "admin", admin: true });
  }),
);

it.effect("the database never holds a token itself", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const database = yield* freshDatabasePath;
    const server = yield* startServe(database);
    const [adminToken] = adminTokensIn(server.lines);
    if (adminToken === undefined) return expect.unreachable("The first boot printed no admin token.");
    const admin = createCookoutClient({ url: server.url, token: adminToken, env: {} });
    yield* Effect.promise(() => admin.whoami());
    yield* server.stop;

    const folder = path.dirname(database);
    const files = yield* fs.readDirectory(folder);
    expect(files).toContain("cookout.db");
    for (const file of files) {
      const bytes = yield* fs.readFile(path.join(folder, file));
      expect(new TextDecoder("latin1").decode(bytes)).not.toContain(adminToken);
    }
  }).pipe(Effect.provide(NodeServices.layer)),
);
