#!/usr/bin/env node
/**
 * The `cookout` program: the one place effects run in production. It provides
 * the live Layers and runs the command line. `serve` serves the web UI that
 * `pnpm build` puts in `web/` next to the built file (`dist/web/`).
 */
import { Cause, Effect, Exit, Layer, Runtime } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { runCookout } from "./modules/cli/server.ts";
import { secretsLive } from "./modules/secrets/server.ts";
import { sqliteStorage } from "./modules/storage/server.ts";

const webFolder = `${import.meta.dirname}/web`;

const stopIsSuccess: Runtime.Teardown = (exit, onExit) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? onExit(0) : Runtime.defaultTeardown(exit, onExit);

runCookout(process.argv.slice(2), { storage: sqliteStorage, webFolder }).pipe(
  Effect.provide(Layer.merge(NodeServices.layer, secretsLive)),
  NodeRuntime.runMain({ disableErrorReporting: true, teardown: stopIsSuccess }),
);
