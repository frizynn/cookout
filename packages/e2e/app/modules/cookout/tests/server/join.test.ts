import type { BinNeeds, BinResult, CookoutUnderTestService } from "../../server.ts";
import { CookoutUnderTest, cookoutUnderTest, freshStateFolder } from "../../server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { FileSystem } from "effect";
import type { IdentityWithTokenResponse } from "@ai-hero/cookout/sdk";
import { NodeServices } from "@effect/platform-node";

type Needs = BinNeeds | FileSystem.FileSystem;

const EXIT_FAILURE = 1;
const joined = { exitCode: 0, stderr: "" };

function joinInItsOwnProcess(
  cookout: CookoutUnderTestService,
  { identity, token }: IdentityWithTokenResponse,
): Effect.Effect<BinResult, never, Needs> {
  return Effect.flatMap(freshStateFolder, (stateFolder) =>
    cookout.runCookout({ args: ["join", "--as", identity.name], stateFolder, token }),
  );
}

it.live("two agents each join through the cookout bin, and a second join on one of them is refused with 409", () =>
  Effect.gen(function* twoAgentsJoin() {
    const cookout = yield* CookoutUnderTest;
    const first = yield* cookout.createIdentity("agent-1");
    const second = yield* cookout.createIdentity("agent-2");
    const firstJoin = yield* joinInItsOwnProcess(cookout, first);
    const secondJoin = yield* joinInItsOwnProcess(cookout, second);
    const again = yield* joinInItsOwnProcess(cookout, first);

    expect([firstJoin, secondJoin]).toMatchObject([joined, joined]);
    expect(firstJoin.stdoutJson).toHaveProperty("leaseId");
    expect(secondJoin.stdoutJson).toHaveProperty("leaseId");
    expect(again).toMatchObject({
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "lease_held", status: 409 } },
      stdout: "",
    });
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);
