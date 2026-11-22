/**
 * The dev program behind `pnpm dev` and `pnpm seed`: the cookout on a
 * temporary SQLite file with a webhook fake, for verifying a change locally
 * (ADR 0017). It is never built or published.
 */
import { Cause, Exit, Runtime } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { devCommandLine } from "./modules/testing/server.ts";

const ARGUMENTS_FROM = 2;
const EXIT_SUCCESS = 0;

function stopIsSuccess(exit: Exit.Exit<unknown, unknown>, onExit: (code: number) => void): void {
  if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
    onExit(EXIT_SUCCESS);
    return;
  }
  Runtime.defaultTeardown(exit, onExit);
}

NodeRuntime.runMain(devCommandLine(process.argv.slice(ARGUMENTS_FROM)), {
  disableErrorReporting: true,
  teardown: stopIsSuccess,
});
