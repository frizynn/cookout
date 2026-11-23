/**
 * The dev program behind `pnpm dev` and `pnpm seed`: the cookout on a
 * temporary SQLite file with a webhook fake, for verifying a change locally
 * (ADRs 0017 and 0020). It is never built or published.
 */
import { Cause, Effect, Exit, Runtime } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { devCommandLine } from "./modules/dev/server.ts";

const ARGUMENTS_FROM = 2;
const EXIT_SUCCESS = 0;

function stopIsSuccess(exit: Exit.Exit<unknown, unknown>, onExit: (code: number) => void): void {
  if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
    onExit(EXIT_SUCCESS);
    return;
  }
  Runtime.defaultTeardown(exit, onExit);
}

NodeRuntime.runMain(devCommandLine(process.argv.slice(ARGUMENTS_FROM)).pipe(Effect.provide(NodeServices.layer)), {
  disableErrorReporting: true,
  teardown: stopIsSuccess,
});
