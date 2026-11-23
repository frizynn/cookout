/**
 * Commands on the backend: the routes that register a command (admin only),
 * list them and call one (any identity). Adding a command checks its schema
 * compiles, makes its handler identity, an agent with the command's name
 * (ADR 0027), or reuses an agent of that name, and issues the command's
 * secret from `Secrets`, shown once. A call's data is checked against the
 * command's JSON Schema, then posted as a top-level message by the caller,
 * and the answer comes without waiting for any delivery to the webhook.
 * `commandsLayer` sends each call to the command's URL in the background:
 * `{ command, data, channel, threadId, token, callId }` as JSON, signed in the
 * `cookout-signature` header with the hex HMAC-SHA256 of the raw body keyed
 * with the command's secret, and given up after `COOKOUT_WEBHOOK_TIMEOUT_SECONDS`. A delivery with no `2xx` is
 * retried 5 times with the same `callId`, with exponential backoff from `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS` by
 * `COOKOUT_WEBHOOK_RETRY_FACTOR`; after the last failure the handler identity replies in the call's thread that the
 * delivery failed.
 */
import {
  AddCommandRequestSchema,
  CallCommandRequestSchema,
  CallCommandResponseSchema,
  CommandWithSecretResponseSchema,
  ListCommandsResponseSchema,
} from "./lib/server/wire.ts";
import { Caller, requireAdmin } from "../identities/server.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { commandCallsPath, commandsPath } from "./index.ts";
import type { CallNeeds } from "./lib/server/call.ts";
import { Effect } from "effect";
import type { Route } from "../http/server.ts";
import type { Secrets } from "../secrets/server.ts";
import { Storage } from "../storage/server.ts";
import { addCommand } from "./lib/server/add.ts";
import { callCommand } from "./lib/server/call.ts";

const CREATED = 201;
const ACCEPTED = 202;

const addRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* addCommandRoute() {
      yield* requireAdmin;
      const fields = yield* HttpServerRequest.schemaBodyJson(AddCommandRequestSchema, { errors: "all" });
      const added = yield* addCommand(fields);
      return yield* HttpServerResponse.schemaJson(CommandWithSecretResponseSchema)(added, { status: CREATED });
    }),
  method: "POST",
  path: commandsPath,
};

const listRoute: Route<Storage> = {
  handle: () =>
    Effect.gen(function* listCommandsRoute() {
      const storage = yield* Storage;
      const commands = yield* storage.listCommands;
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
export const commandRoutes: readonly Route<Caller | Secrets | CallNeeds>[] = [addRoute, listRoute, callRoute];

/** The response Schemas of the command routes, for the SDK's generated validators. */
export const commandResponseSchemas = {
  CallCommandResponse: CallCommandResponseSchema,
  CommandWithSecretResponse: CommandWithSecretResponseSchema,
  ListCommandsResponse: ListCommandsResponseSchema,
};

/** The services the command routes need beyond storage: the background webhook delivery of each call. */
export { deliveriesLayer as commandsLayer } from "./lib/server/call.ts";
