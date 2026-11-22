import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { runCookout, TestCookout, testCookout } from "../../testing/server.ts";

it.effect("the CLI says who you are, as JSON", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent", { owner: "matt" });
    const result = yield* runCookout(["whoami"], { COOKOUT_URL: cookout.url, COOKOUT_TOKEN: agent.token });
    expect(result, result.stderr).toMatchObject({ exitCode: 0 });
    expect(JSON.parse(result.stdout)).toEqual({ identity: agent.identity });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI creates, lists and gets channels, as JSON", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const env = { COOKOUT_URL: cookout.url, COOKOUT_TOKEN: agent.token };
    const created = yield* runCookout(["channel", "create", "grill", "--description", "Grill it"], env);
    expect(created, created.stderr).toMatchObject({ exitCode: 0 });
    expect(JSON.parse(created.stdout)).toEqual({
      channel: { name: "grill", description: "Grill it", createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect((yield* runCookout(["channel", "create", "general"], env)).exitCode).toBe(0);
    const listed = yield* runCookout(["channel", "list"], env);
    expect(JSON.parse(listed.stdout)).toMatchObject({ channels: [{ name: "general" }, { name: "grill" }] });
    expect(JSON.parse((yield* runCookout(["channel", "get", "grill"], env)).stdout)).toEqual(
      JSON.parse(created.stdout),
    );
    const missing = yield* runCookout(["channel", "get", "nowhere"], env);
    expect(missing.exitCode).toBe(1);
    expect(JSON.parse(missing.stderr)).toMatchObject({ error: { code: "channel_not_found", status: 404 } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI exits 1 with a JSON error on stderr when the token is missing", () =>
  Effect.gen(function* () {
    const cookout = yield* TestCookout;
    const result = yield* runCookout(["whoami"], { COOKOUT_URL: cookout.url });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: "token_missing", status: 401 } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI says so when COOKOUT_URL is not set", () =>
  Effect.gen(function* () {
    const result = yield* runCookout(["whoami"], {});
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: "url_missing" } });
  }),
);

it.effect("the CLI refuses an unknown command with a usage error", () =>
  Effect.gen(function* () {
    const result = yield* runCookout(["identity", "explode"], { COOKOUT_URL: "http://127.0.0.1:1" });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: "usage" } });
  }),
);
