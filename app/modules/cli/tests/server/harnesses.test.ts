import type { CliResult, CommandLineNeeds } from "../../../testing/server.ts";
import { TestCookout, answer, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const POST = ["message", "post", "grill", "hello"] as const;
const CLAUDE_CODE = { AI_AGENT: "claude-code", CLAUDECODE: "1" } as const;

type Markers = Readonly<Record<string, string>>;

function postAs(
  kind: "human" | "agent",
  markers: Markers,
): Effect.Effect<CliResult, never, CommandLineNeeds | TestCookout> {
  return Effect.gen(function* postFromCommandLine() {
    const cookout = yield* TestCookout;
    const poster = yield* cookout.createIdentity("poster", { kind });
    yield* answer(() => poster.client.createChannel({ name: "grill" }));
    return yield* runCookout({
      args: POST,
      env: { ...markers, COOKOUT_TOKEN: poster.token, COOKOUT_URL: cookout.url },
    });
  });
}

it.effect("from Claude Code, cookout refuses a human's token with exit code 1 and agent_as_human", () =>
  Effect.gen(function* humanFromAgent() {
    const refused = yield* postAs("human", CLAUDE_CODE);

    expect(refused).toMatchObject({
      exitCode: 1,
      stderrJson: { error: { code: "agent_as_human", details: { harness: "claude-code", identity: "poster" } } },
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("from Claude Code with COOKOUT_ALLOW_HUMAN=1, cookout posts with a human's token and records no tool", () =>
  Effect.gen(function* allowHuman() {
    const allowed = yield* postAs("human", { ...CLAUDE_CODE, COOKOUT_ALLOW_HUMAN: "1" });

    expect(allowed).toMatchObject({ exitCode: 0, stdoutJson: { message: { author: { name: "poster" } } } });
    expect(allowed.stdoutJson).not.toHaveProperty("message.harness");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("with no agent markers, cookout posts with a human's token", () =>
  Effect.gen(function* humanByHand() {
    const byHand = yield* postAs("human", {});

    expect(byHand).toMatchObject({ exitCode: 0, stdoutJson: { message: { author: { name: "poster" } } } });
    expect(byHand.stdoutJson).not.toHaveProperty("message.harness");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("from Claude Code, cookout posts with an agent's token and the message records the tool", () =>
  Effect.gen(function* agentFromAgent() {
    const posted = yield* postAs("agent", { CLAUDECODE: "1" });

    expect(posted).toMatchObject({ exitCode: 0, stdoutJson: { message: { harness: "claude-code" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

const otherTools = [
  { markers: { CODEX_THREAD_ID: "019a-thread" }, tool: "codex" },
  { markers: { CURSOR_AGENT: "1" }, tool: "cursor" },
  { markers: { GEMINI_CLI: "1" }, tool: "gemini-cli" },
  { markers: { CLINE_ACTIVE: "true" }, tool: "cline" },
  { markers: { AI_AGENT: "opencode", OPENCODE: "1" }, tool: "opencode" },
] as const;

it.effect.each(otherTools)("from $tool, cookout refuses a human's token naming $tool", ({ markers, tool }) =>
  Effect.gen(function* humanFromOtherTool() {
    const refused = yield* postAs("human", markers);

    expect(refused).toMatchObject({
      exitCode: 1,
      stderrJson: { error: { code: "agent_as_human", details: { harness: tool } } },
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
