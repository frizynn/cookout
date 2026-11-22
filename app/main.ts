#!/usr/bin/env node
/**
 * The `cookout` program: the one place effects run in production. It provides
 * the live Layers and runs the command line.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, Runtime } from "effect";
import { runCookout } from "./modules/cli/server.ts";
import { secretsLive } from "./modules/secrets/server.ts";
import { sqliteStorage } from "./modules/storage/server.ts";

const stopIsSuccess: Runtime.Teardown = (exit, onExit) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? onExit(0) : Runtime.defaultTeardown(exit, onExit);

runCookout(process.argv.slice(2), { storage: sqliteStorage, secrets: secretsLive }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain({ disableErrorReporting: true, teardown: stopIsSuccess }),
);
