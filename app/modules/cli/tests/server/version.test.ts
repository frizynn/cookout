import { commandLineServices, runCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import packageJson from "../../../../../package.json" with { type: "json" };

it.effect("cookout --version prints the version in package.json", () =>
  Effect.gen(function* version() {
    const result = yield* runCookout({ args: ["--version"], env: {} });

    expect(result).toMatchObject({ exitCode: 0, stderr: "", stdout: `cookout v${packageJson.version}` });
  }).pipe(Effect.provide(commandLineServices)),
);
