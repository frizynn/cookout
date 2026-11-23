import { Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, IdentityName } from "../../index.ts";
import { IdentityResponseSchema, OwnerSchema } from "./wire.ts";
import { identityNotFound, nameParam } from "./routes.ts";
import type { Caller } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { TransferAgentResult } from "../../../storage/server.ts";
import { identityOwnerPath } from "../../index.ts";
import { ownerNotHuman } from "./create.ts";
import { requireAdmin } from "./auth.ts";

const BAD_REQUEST = 400;
const FORBIDDEN = 403;

const TransferAgentRequestSchema = Schema.Struct({ owner: OwnerSchema });

interface Transfer {
  readonly name: IdentityName;
  readonly owner: IdentityName;
}

function onlyAgentsTransfer(name: IdentityName): Refusal {
  return {
    code: "identity_kind",
    message: `${name} is a human identity; only an agent has an owner to transfer.`,
    status: FORBIDDEN,
  };
}

function namespacedTransfer({ name, owner }: Transfer): Refusal {
  return {
    code: "name_not_owned",
    message: `${name} is namespaced to its owner, so it can only move to ${owner} with a rename. Create a new agent for ${owner} instead.`,
    status: BAD_REQUEST,
  };
}

function transferRefusal(transfer: Transfer, status: Exclude<TransferAgentResult["status"], "transferred">): Refusal {
  const refusals = {
    name_not_owned: () => namespacedTransfer(transfer),
    not_agent: () => onlyAgentsTransfer(transfer.name),
    not_found: () => identityNotFound(transfer.name),
    owner_not_human: () => ownerNotHuman(transfer.owner),
  } as const;
  return refusals[status]();
}

function transferredIdentity(transfer: Transfer, result: TransferAgentResult): Effect.Effect<Identity, Refusal> {
  if (result.status === "transferred") {
    return Effect.succeed(result.identity);
  }
  return Effect.fail(transferRefusal(transfer, result.status));
}

const transferRoute: Route<Caller | Storage> = {
  handle: (params) =>
    Effect.gen(function* transferAgentRoute() {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const { owner } = yield* HttpServerRequest.schemaBodyJson(TransferAgentRequestSchema);
      const storage = yield* Storage;
      const result = yield* storage.transferAgent(name, owner);
      const identity = yield* transferredIdentity({ name, owner }, result);
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
    }),
  method: "PUT",
  path: identityOwnerPath,
};

export const transferRoutes: readonly Route<Caller | Storage>[] = [transferRoute];
