/**
 * Commands on the backend: the routes that register a command and rotate its
 * secret (admin only), list them and call one (any identity). Adding a command checks its schema
 * compiles, makes its handler identity, an agent with the command's name
 * (ADR 0027), or reuses an agent of that name, and issues the command's
 * secret from `Secrets`, shown once; the live stream announces it to every web UI. Rotating issues a new secret the same way,
 * and the old one signs no delivery from then on. A call's data is checked against the
 * command's JSON Schema, then posted as a top-level message by the caller,
 * and the answer comes without waiting for any delivery to the webhook.
 * `commandsLayer` sends each call to the command's URL in the background:
 * `{ command, data, channel, threadId, token, callId }` as JSON, signed in the
 * `cookout-signature` header with the hex HMAC-SHA256 of the raw body keyed
 * with the command's secret, and given up after `COOKOUT_WEBHOOK_TIMEOUT_SECONDS`. A delivery with no `2xx` (a redirect is never followed, so it
 * counts as one) is retried 5 times with the same `callId`, with exponential backoff from `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS` by
 * `COOKOUT_WEBHOOK_RETRY_FACTOR`; after the last failure the handler identity replies in the call's thread that the
 * delivery failed. Each delivery's `attempts` is stored: the attempts made at it so far, the first included (6 at
 * most). So a restarted server resumes the pending ones on the same backoff with the same `callId`, making only the
 * attempts left, and with a new command token that still expires 24 h after the call.
 */
import {
  AddCommandRequestSchema,
  CallCommandRequestSchema,
  CallCommandResponseSchema,
  CommandWithSecretResponseSchema,
  ListCommandsResponseSchema,
} from "./lib/server/wire.ts";
import { Caller, requireAdmin } from "../identities/server.ts";
import { Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { addCommand, rotateCommandSecret } from "./lib/server/add.ts";
import { callCommand, deliveriesLayer } from "./lib/server/call.ts";
import { commandCallsPath, commandSecretPath, commandsPath } from "./index.ts";
import { spawningLayer, withBuiltInCommands } from "./lib/server/spawning.ts";
import type { AddNeeds } from "./lib/server/add.ts";
import type { CallNeeds } from "./lib/server/call.ts";
import type { Route } from "../http/server.ts";
import { Storage } from "../storage/server.ts";

const CREATED = 201;
const ACCEPTED = 202;

const addRoute: Route<Caller | AddNeeds> = {
  handle: () =>
    Effect.gen(function* addCommandRoute() {
      yield* requireAdmin;
      const caller = yield* Caller;
      const fields = yield* HttpServerRequest.schemaBodyJson(AddCommandRequestSchema, { errors: "all" });
      const added = yield* addCommand({ fields, owner: caller.name });
      return yield* HttpServerResponse.schemaJson(CommandWithSecretResponseSchema)(added, { status: CREATED });
    }),
  method: "POST",
  path: commandsPath,
};

const rotateRoute: Route<Caller | AddNeeds> = {
  handle: (params) =>
    Effect.gen(function* rotateSecretRoute() {
      yield* requireAdmin;
      const rotated = yield* rotateCommandSecret(String(params["name"]));
      return yield* HttpServerResponse.schemaJson(CommandWithSecretResponseSchema)(rotated);
    }),
  method: "POST",
  path: commandSecretPath,
};

const listRoute: Route<Storage> = {
  handle: () =>
    Effect.gen(function* listCommandsRoute() {
      const storage = yield* Storage;
      const registered = yield* storage.listCommands;
      const commands = withBuiltInCommands(registered);
      return yield* HttpServerResponse.schemaJson(ListCommandsResponseSchema)({ commands });
    }),
  method: "GET",
  path: commandsPath,
};

const callRoute: Route<Caller | CallNeeds> = {
  handle: (params) =>
    Effect.gen(function* callCommandRoute() {
      const fields = yield* HttpServerRequest.schemaBodyJson(CallCommandRequestSchema, { errors: "all" });
      const caller = yield* Caller;
      const called = yield* callCommand({ ...fields, caller, name: String(params["name"]) });
      return yield* HttpServerResponse.schemaJson(CallCommandResponseSchema)(called, { status: ACCEPTED });
    }),
  method: "POST",
  path: commandCallsPath,
};

/** The command routes, for the server's route list. They need `Caller`, which `requireToken` provides. */
export const commandRoutes: readonly Route<Caller | AddNeeds | CallNeeds>[] = [
  addRoute,
  rotateRoute,
  listRoute,
  callRoute,
];

/** The response Schemas of the command routes, for the SDK's generated validators. */
export const commandResponseSchemas = {
  CallCommandResponse: CallCommandResponseSchema,
  CommandWithSecretResponse: CommandWithSecretResponseSchema,
  ListCommandsResponse: ListCommandsResponseSchema,
};

/**
 * The services the command routes need beyond storage: the background webhook delivery of each call, and
 * `/spawn-agent`, the one command the server handles itself (mattpocock/cookout#231). On start it resumes the
 * deliveries a stopped server left pending, with the same call IDs. `/spawn-agent` posts its call message, then in the
 * background creates the agent with a join code (`AgentSessions`), fires the routine and replies in the thread as
 * `spawn-agent`, an agent owned by the admin, made when first needed; a failed fire deactivates the new agent.
 */
export const commandsLayer = Layer.merge(deliveriesLayer, spawningLayer);

/**
 * How the server was started, for `/spawn-agent`: the board's public URL, which a spawned session joins, and the
 * admin who owns its handler identity, `spawn-agent`.
 */
export { SpawnSettings } from "./lib/server/spawning.ts";

/**
 * The `CommandChanges` hub: registering a command and rotating its secret each publish the command, and the live
 * stream sends each on as a `command` event.
 */
export { CommandChanges, commandChangesLayer } from "./lib/server/changes.ts";

/** The Schema of a command as the server shows it, for the live stream's `command` event. */
export { RegisteredCommandSchema } from "./lib/server/wire.ts";
