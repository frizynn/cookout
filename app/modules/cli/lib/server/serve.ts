import { Command, Flag } from "effect/cli";
import { Effect, Layer, Option, Redacted } from "effect";
import type { IdentityName, Token } from "../../../identities/index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  adminName,
  adminNameRule,
  adminToken,
  adminTokenRule,
  databasePath,
  host,
  port,
  publicUrl,
} from "../../../config/server.ts";
import { domainLayers, routes } from "./route-list.ts";
import { firstAdminName, token } from "../../../identities/index.ts";
import { httpServer, serverUrl } from "../../../http/server.ts";
import { printLine, refused } from "./output.ts";

import type { AdminNameIsAgent } from "../../../identities/server.ts";
import type { CommandFailed } from "./output.ts";
import type { FileSystem } from "effect";
import type { Serving } from "../../../http/server.ts";
import { adminTokenSet } from "../../../identities/server.ts";
import { requireTokenAndRenewLease } from "../../../leases/server.ts";

export type ServeLayers = {
  readonly storage: (path: string) => Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem>;
  readonly webFolder?: string;
};

export const cookoutServer = ({
  adminName: name = firstAdminName,
  adminToken: admin,
  ...serving
}: Serving & { readonly adminToken: Token; readonly adminName?: IdentityName }) =>
  httpServer(serving, routes, requireTokenAndRenewLease).pipe(
    Layer.provideMerge(adminTokenSet({ adminName: name, adminToken: admin })),
    Layer.provideMerge(domainLayers),
  );

function webFolderOf({ webFolder }: ServeLayers): Pick<Serving, "webFolder"> {
  return Option.match(Option.fromNullishOr(webFolder), {
    onNone: () => ({}),
    onSome: (folder) => ({ webFolder: folder }),
  });
}

const invalidAdminToken = { code: "admin_token_invalid", message: adminTokenRule };

const adminTokenOrRefuse = Effect.gen(function* readAdminToken() {
  const value = yield* adminToken;
  return token(Redacted.value(value));
}).pipe(Effect.catchTag("ConfigError", () => refused(invalidAdminToken)));

const invalidAdminName = { code: "admin_name_invalid", message: adminNameRule };

const adminNameOrRefuse = adminName.pipe(Effect.catchTag("ConfigError", () => refused(invalidAdminName)));

function adminNameIsAgent({
  adminName: name,
}: Pick<AdminNameIsAgent, "adminName">): Effect.Effect<never, CommandFailed> {
  const agentName = {
    code: "admin_name_agent",
    message: `COOKOUT_ADMIN_NAME is ${name}, an agent on this board, and only a human can be an admin. Choose another name.`,
  };
  return refused(agentName);
}

const runServer = (layers: ServeLayers, listen: Omit<Serving, "webFolder">, database: string) =>
  Effect.gen(function* () {
    const admin = yield* adminTokenOrRefuse;
    const name = yield* adminNameOrRefuse;
    const services = yield* Layer.build(
      cookoutServer({ ...listen, ...webFolderOf(layers), adminName: name, adminToken: admin }).pipe(
        Layer.provide(layers.storage(database)),
      ),
    ).pipe(Effect.catchTag("AdminNameIsAgent", adminNameIsAgent));
    const url = yield* serverUrl.pipe(Effect.provideContext(services));
    yield* printLine({ database, listening: url });
    return yield* Effect.never;
  }).pipe(Effect.scoped);

export const serveCommand = (layers: ServeLayers) =>
  Command.make(
    "serve",
    {
      db: Flag.String("db").pipe(
        Flag.withFallbackConfig(databasePath),
        Flag.withDescription("The SQLite file (COOKOUT_DB)."),
      ),
      host: Flag.String("host").pipe(
        Flag.withFallbackConfig(host),
        Flag.withDescription("The address to listen on (COOKOUT_HOST)."),
      ),
      port: Flag.Int("port").pipe(Flag.withFallbackConfig(port), Flag.withDescription("The port to listen on (PORT).")),
      publicUrl: Flag.String("public-url").pipe(
        Flag.withFallbackConfig(publicUrl),
        Flag.withDescription("The address it is deployed at, whose host it also answers (COOKOUT_PUBLIC_URL)."),
      ),
    },
    (flags) => runServer(layers, { host: flags.host, port: flags.port, publicUrl: flags.publicUrl }, flags.db),
  ).pipe(Command.withDescription("Start the cookout server on SQLite."));
