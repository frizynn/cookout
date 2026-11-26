import { TestCookout, answer, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ROUTER = "https://router.example.com/route";
const routed: readonly string[] = ["channel", "route", "general", "--router", ROUTER, "--fallback", "night-shift"];
const woken: readonly string[] = [
  ...routed,
  "--wake-harness",
  "claude",
  "--wake-model",
  "sonnet",
  "--wake-effort",
  "high",
];
const harnessOnly: readonly string[] = [...routed, "--wake-harness", "codex"];
const modelOnly: readonly string[] = [...routed, "--wake-model", "sonnet"];

it.effect("cookout channel route --wake-harness, --wake-model and --wake-effort set the fallback's new session", () =>
  Effect.gen(function* routeWithWake() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("ada", { kind: "human" });
    yield* cookout.createIdentity("night-shift", { owner: "ada" });
    yield* answer(() => cookout.client.createChannel({ name: "general" }));
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const results = yield* Effect.forEach([woken, harnessOnly], (args) => runCookout({ args, env }), ONE_AT_A_TIME);
    const cleared = yield* runCookout({ args: routed, env });

    expect(results).toMatchObject([
      {
        exitCode: 0,
        stdoutJson: { channel: { fallbackWake: { effort: "high", harness: "claude", model: "sonnet" } } },
      },
      {
        exitCode: 0,
        stdoutJson: { channel: { fallbackWake: { effort: "default", harness: "codex", model: "default" } } },
      },
    ]);
    expect(cleared).toMatchObject({ exitCode: 0, stdoutJson: { channel: { fallback: "night-shift" } } });
    expect(cleared.stdoutJson).not.toHaveProperty("channel.fallbackWake");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout channel route --wake-model without --wake-harness is a usage error", () =>
  Effect.gen(function* modelWithoutHarness() {
    const env = { COOKOUT_URL: "http://127.0.0.1:1" };
    const result = yield* runCookout({ args: modelOnly, env });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }).pipe(Effect.provide(commandLineServices)),
);
