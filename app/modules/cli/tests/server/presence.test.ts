import { TestCookout, answer, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const list: readonly string[] = ["identity", "list"];
const whoamiArgs: readonly string[] = ["whoami"];

it.effect("cookout identity list and whoami print each identity's presence", () =>
  Effect.gen(function* presencePrinted() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann", { kind: "human" });
    yield* Effect.acquireRelease(
      answer(() => ann.client.watch()),
      (events) => answer(() => events.close()),
    );
    const env = { COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url };
    const [listed, whoami] = yield* Effect.forEach(
      [list, whoamiArgs],
      (args) => runCookout({ args, env }),
      ONE_AT_A_TIME,
    );

    expect(listed).toMatchObject({
      exitCode: 0,
      stdoutJson: {
        identities: [
          { name: "admin", presence: { identity: "admin", online: false } },
          { name: "ann", presence: { connection: { via: "watch" }, identity: "ann", online: true } },
        ],
      },
    });
    expect(whoami).toMatchObject({
      exitCode: 0,
      stdoutJson: { identity: { name: "ann", presence: { identity: "ann", online: true } } },
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
