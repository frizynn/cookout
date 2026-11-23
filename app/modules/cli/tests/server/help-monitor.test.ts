import { Effect, FileSystem, String as Str } from "effect";
import { commandLineServices, runCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const monitorInvocation =
  'Monitor({ command: "cookout watch", description: "cookout inbox for <identity>", timeout_ms: 1800000 })';

it.effect("cookout help monitor prints the exact Monitor invocation and exits 0", () =>
  Effect.gen(function* helpMonitor() {
    const result = yield* runCookout({ args: ["help", "monitor"], env: {} });

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(result.stdout).toContain(monitorInvocation);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the README carries cookout help monitor word for word", () =>
  Effect.gen(function* readmeMatches() {
    const fs = yield* FileSystem.FileSystem;
    const readme = yield* fs.readFileString("README.md");
    const result = yield* runCookout({ args: ["help", "monitor"], env: {} });

    expect(result.stdout).toContain(monitorInvocation);
    expect(readme).toContain(Str.trim(result.stdout));
  }).pipe(Effect.provide(commandLineServices)),
);
