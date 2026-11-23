import { Command, Flag } from "effect/cli";
import { Effect, Layer, Option, Redacted } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { adminToken, adminTokenRule, databasePath, host, port, publicUrl } from "../../../config/server.ts";
import { domainLayers, routes } from "./route-list.ts";
import { httpServer, serverUrl } from "../../../http/server.ts";
import { printLine, refused } from "./output.ts";
import type { FileSystem } from "effect";
import type { Serving } from "../../../http/server.ts";
import type { Token } from "../../../identities/index.ts";
import { adminTokenSet } from "../../../identities/server.ts";
import { requireTokenWithinLimit } from "./gate.ts";
import { token } from "../../../identities/index.ts";

export type ServeLayers = {
  readonly storage: (path: string) => Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem>;
  readonly webFolder?: string;
};

export const cookoutServer = ({ adminToken: admin, ...serving }: Serving & { readonly adminToken: Token }) =>
  httpServer(serving, routes, requireTokenWithinLimit).pipe(
    Layer.provideMerge(adminTokenSet(admin)),
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

const runServer = (layers: ServeLayers, listen: Omit<Serving, "webFolder">, database: string) =>
  Effect.gen(function* () {
    const admin = yield* adminTokenOrRefuse;
    const services = yield* Layer.build(
      cookoutServer({ ...listen, ...webFolderOf(layers), adminToken: admin }).pipe(
        Layer.provide(layers.storage(database)),
      ),
    );
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
