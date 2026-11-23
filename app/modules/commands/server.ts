/**
 * Commands on the backend: the routes that register a command (admin only)
 * and list them (any identity). Adding a command makes its handler identity,
 * an agent with the command's name (ADR 0027), or reuses an agent of that
 * name, and issues the command's secret from `Secrets`, shown once.
 */
import {
  AddCommandRequestSchema,
  CommandWithSecretResponseSchema,
  ListCommandsResponseSchema,
} from "./lib/server/wire.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Caller } from "../identities/server.ts";
import { Effect } from "effect";
import type { Route } from "../http/server.ts";
import type { Secrets } from "../secrets/server.ts";
import { Storage } from "../storage/server.ts";
import { addCommand } from "./lib/server/add.ts";
import { commandsPath } from "./index.ts";
import { requireAdmin } from "../identities/server.ts";

const CREATED = 201;

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

/** The command routes, for the server's route list. They need `Caller`, which `requireToken` provides. */
export const commandRoutes: readonly Route<Caller | Storage | Secrets>[] = [addRoute, listRoute];

/** The response Schemas of the command routes, for the SDK's generated validators. */
export const commandResponseSchemas = {
  CommandWithSecretResponse: CommandWithSecretResponseSchema,
  ListCommandsResponse: ListCommandsResponseSchema,
};
