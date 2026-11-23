import { Command, Flag } from "effect/cli";
import { Effect, Layer } from "effect";
import { FirstBoot, firstBoot } from "../../../identities/server.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { databasePath, host, port } from "../../../config/server.ts";
import { domainLayers, routes } from "./route-list.ts";
import { httpServer, serverUrl } from "../../../http/server.ts";
import type { FileSystem } from "effect";
import type { Listen } from "../../../http/server.ts";
import { printLine } from "./output.ts";
import { requireTokenAndRenewLease } from "../../../leases/server.ts";

export type ServeLayers = {
  readonly storage: (path: string) => Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem>;
};

export const cookoutServer = (listen: Listen) =>
  httpServer(listen, routes, requireTokenAndRenewLease).pipe(
    Layer.provideMerge(firstBoot),
    Layer.provideMerge(domainLayers),
  );

const printAdminToken = Effect.gen(function* () {
  const { adminToken } = yield* FirstBoot;
  if (adminToken === undefined) {
    return;
  }
  yield* printLine({
    adminToken,
    identity: "admin",
    message: "First boot: this is the admin token. It is shown only this once; keep it safe.",
  });
});

const runServer = (layers: ServeLayers, listen: Listen, database: string) =>
  Effect.gen(function* () {
    const services = yield* Layer.build(cookoutServer(listen).pipe(Layer.provide(layers.storage(database))));
    yield* printAdminToken.pipe(Effect.provideContext(services));
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
    },
    (flags) => runServer(layers, { host: flags.host, port: flags.port }, flags.db),
  ).pipe(Command.withDescription("Start the cookout server on SQLite."));
