#!/usr/bin/env node
/**
 * The example handler program: the one place its effects run. It reads
 * `COOKOUT_COMMAND_SECRET` (the command's HMAC secret), `HOST` (default
 * `0.0.0.0`) and `PORT` (default 8787), and serves until stopped.
 */
import { Config, Console, Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { handlerServer } from "./modules/handler/server.ts";

const DEFAULT_PORT = 8787;

const options = Config.all({
  host: Config.String("HOST").pipe(Config.withDefault("0.0.0.0")),
  port: Config.Port("PORT").pipe(Config.withDefault(DEFAULT_PORT)),
  secret: Config.Redacted("COOKOUT_COMMAND_SECRET"),
});

const program = Effect.gen(function* serve() {
  const read = yield* options;
  return yield* Layer.launch(
    handlerServer({
      ...read,
      onCall: (call) => Console.log(`call ${call.callId} of ${call.command} on thread ${String(call.threadId)}`),
    }),
  );
});

NodeRuntime.runMain(program);
