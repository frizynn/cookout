import { Effect, FileSystem, Path } from "effect";
import {
  TestCookout,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";

interface SchemaFile {
  readonly file: string;
  readonly folder: string;
}

const schema = { properties: { branch: { type: "string" } }, type: "object" };
const schemaText = '{"properties":{"branch":{"type":"string"}},"type":"object"}';
const url = "https://hooks.example.com/deploy";

const schemaFile: Effect.Effect<SchemaFile, never, FileSystem.FileSystem | Path.Path | Scope.Scope> = Effect.gen(
  function* writeSchemaFile() {
    const folder = yield* freshStateFolder;
    const fs = yield* FileSystem.FileSystem;
    const file = (yield* Path.Path).join(folder, "deploy.schema.json");
    yield* Effect.orDie(fs.writeFileString(file, schemaText));
    return { file, folder };
  },
);

it.effect("cookout command add reads the schema file and prints the secret once; cookout command list shows it", () =>
  Effect.gen(function* addAndList() {
    const cookout = yield* TestCookout;
    const { file, folder } = yield* schemaFile;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const added = yield* runCookout({
      args: ["command", "add", "deploy", "--url", url, "--schema", file, "--description", "Ship it"],
      env,
    });
    const listed = yield* runCookout({ args: ["command", "list"], env });
    const command = { description: "Ship it", handler: "deploy", name: "deploy", schema, url };

    expect(added).toMatchObject({ exitCode: 0, stdoutJson: { command, secret: "hmac_test_2" } });
    expect(listed).toMatchObject({ exitCode: 0, stdoutJson: { commands: [command] } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout command add by an identity that is not an admin exits 1 with admin_only", () =>
  Effect.gen(function* notAdmin() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const { file, folder } = yield* schemaFile;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url };
    const result = yield* runCookout({ args: ["command", "add", "deploy", "--url", url, "--schema", file], env });

    expect(result).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "admin_only" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
