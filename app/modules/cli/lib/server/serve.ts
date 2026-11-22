import { Command, Flag } from "effect/cli";
import { Effect, Layer } from "effect";
import { FirstBoot, firstBoot, identitiesLayer, identityRoutes } from "../../../identities/server.ts";
import type { Listen, Route } from "../../../http/server.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { databasePath, host, port } from "../../../config/server.ts";
import { httpServer, serverUrl } from "../../../http/server.ts";
import { leaseRoutes, leasesLayer, requireTokenAndRenewLease } from "../../../leases/server.ts";
import { messageRoutes, messagesLayer } from "../../../messages/server.ts";
import type { FileSystem } from "effect";
import { printLine } from "./output.ts";

export type ServeLayers = {
  readonly storage: (path: string) => Layer.Layer<Storage, StorageUnavailable, FileSystem.FileSystem>;
};

type NeedsOf<Routes> = Routes extends readonly Route<infer Needs>[] ? Needs : never;

type RouteNeeds =
  | NeedsOf<typeof identityRoutes>
  | NeedsOf<typeof channelRoutes>
  | NeedsOf<typeof messageRoutes>
  | NeedsOf<typeof leaseRoutes>;

const routes: readonly Route<RouteNeeds>[] = [...identityRoutes, ...channelRoutes, ...messageRoutes, ...leaseRoutes];

export const cookoutServer = (listen: Listen) =>
  httpServer(listen, routes, requireTokenAndRenewLease).pipe(
    Layer.provideMerge(firstBoot),
    Layer.provideMerge(Layer.mergeAll(identitiesLayer, channelsLayer, messagesLayer, leasesLayer)),
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
